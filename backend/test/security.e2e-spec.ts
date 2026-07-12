import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Security integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let serverPort: number;

  const PNG_BYTES = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address();
    serverPort = typeof address === 'object' && address ? address.port : 0;
    prisma = app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    // Let socket disconnect handlers finish before Redis client closes.
    await new Promise((r) => setTimeout(r, 300));
    await app.close();
  });

  async function loginAgent(
    email = 'agent@demo.com',
    password = 'agent123',
    tenantCode = 'demo001',
  ) {
    const res = await request(app.getHttpServer())
      .post('/auth/agent/login')
      .send({ email, password, tenantCode })
      .expect((r) => expect([200, 201]).toContain(r.status));
    return res.body as {
      accessToken: string;
      agent: { id: string; tenantId?: string };
    };
  }

  async function initVisitor(apiKey = 'cs_demo_api_key_12345') {
    const res = await request(app.getHttpServer())
      .post('/auth/user/init')
      .send({
        apiKey,
        deviceId: `e2e-device-${Date.now()}-${Math.random()}`,
        source: 'e2e',
      })
      .expect((r) => expect([200, 201]).toContain(r.status));
    return res.body as {
      accessToken: string;
      user: { id: string; tenantId: string };
    };
  }

  it('rejects unauthenticated agent inbox', async () => {
    await request(app.getHttpServer()).get('/conversations/agent').expect(401);
  });

  it('accepts platform admin login with seed credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/platform/login')
      .send({ email: 'admin', password: 'admin123' })
      .expect((r) => expect([200, 201]).toContain(r.status));
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects unauthenticated file download', async () => {
    await request(app.getHttpServer()).get('/files/not-a-real-id').expect(401);
  });

  it('rejects TEXT messages containing data URI over REST', async () => {
    const visitor = await initVisitor();
    const me = await request(app.getHttpServer())
      .get('/conversations/me')
      .set('Authorization', `Bearer ${visitor.accessToken}`)
      .expect(200);

    const sessionId = me.body.currentSession?.id as string | undefined;
    expect(sessionId).toBeTruthy();

    await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${visitor.accessToken}`)
      .send({
        sessionId,
        type: 'TEXT',
        content: 'data:image/png;base64,AAAA',
      })
      .expect(400);
  });

  it('isolates sessions across tenants', async () => {
    const visitor = await initVisitor();
    const me = await request(app.getHttpServer())
      .get('/conversations/me')
      .set('Authorization', `Bearer ${visitor.accessToken}`)
      .expect(200);
    const sessionId = me.body.currentSession?.id as string;
    expect(sessionId).toBeTruthy();

    const otherTenant = await prisma.tenant.upsert({
      where: { slug: 'e2e-other' },
      update: {},
      create: {
        tenantCode: 'e2e002',
        name: 'E2E Other',
        slug: 'e2e-other',
        apiKey: 'cs_e2e_other_api_key',
        adminEmail: 'admin@e2e-other.com',
      },
    });

    const password = await bcrypt.hash('agent123', 10);
    await prisma.agent.upsert({
      where: {
        tenantId_email: {
          tenantId: otherTenant.id,
          email: 'agent@e2e-other.com',
        },
      },
      update: { password, role: 'AGENT', accountStatus: 'ACTIVE' },
      create: {
        tenantId: otherTenant.id,
        email: 'agent@e2e-other.com',
        password,
        name: 'Other Agent',
        role: 'AGENT',
        agentCode: 'E2E1',
        accountStatus: 'ACTIVE',
        status: 'OFFLINE',
      },
    });

    const otherLogin = await loginAgent(
      'agent@e2e-other.com',
      'agent123',
      'e2e002',
    );

    await request(app.getHttpServer())
      .get(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${otherLogin.accessToken}`)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it('enforces same-tenant session ownership for visitors', async () => {
    const visitorA = await initVisitor();
    const visitorB = await initVisitor();

    const meA = await request(app.getHttpServer())
      .get('/conversations/me')
      .set('Authorization', `Bearer ${visitorA.accessToken}`)
      .expect(200);
    const sessionA = meA.body.currentSession?.id as string;

    await request(app.getHttpServer())
      .get(`/messages/session/${sessionA}`)
      .set('Authorization', `Bearer ${visitorB.accessToken}`)
      .expect(403);
  });

  it('serves uploaded files only to authorized callers', async () => {
    const agent = await loginAgent();
    const visitor = await initVisitor();

    const me = await request(app.getHttpServer())
      .get('/conversations/me')
      .set('Authorization', `Bearer ${visitor.accessToken}`)
      .expect(200);
    const sessionId = me.body.currentSession?.id as string;

    await request(app.getHttpServer())
      .patch(`/sessions/${sessionId}/assign`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({})
      .expect((r) => expect([200, 201]).toContain(r.status));

    const upload = await request(app.getHttpServer())
      .post('/upload')
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'dot.png',
        contentType: 'image/png',
      })
      .expect((r) => expect([200, 201]).toContain(r.status));

    const fileUrl = upload.body.url as string;
    const fileId = upload.body.id as string;
    expect(fileUrl).toContain(`/files/${fileId}`);

    await request(app.getHttpServer()).get(`/files/${fileId}`).expect(401);

    const record = await prisma.fileUpload.findUnique({ where: { id: fileId } });
    expect(record).toBeTruthy();
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const full = join(process.cwd(), uploadDir, record!.storagePath);
    if (!existsSync(full)) {
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, PNG_BYTES);
    }

    await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);
  });

  it('rejects websocket connection without a valid JWT', async () => {
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = io(`http://127.0.0.1:${serverPort}/ws`, {
        auth: { token: 'invalid' },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        timeout: 5000,
      });
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('WS did not disconnect invalid auth'));
      }, 5000);
      socket.on('disconnect', () => {
        clearTimeout(timer);
        socket.close();
        resolve();
      });
      socket.on('connect_error', () => {
        clearTimeout(timer);
        socket.close();
        resolve();
      });
    });
  });

  it('allows authenticated agent websocket connect', async () => {
    const agent = await loginAgent();
    await new Promise<void>((resolve, reject) => {
      const socket: Socket = io(`http://127.0.0.1:${serverPort}/ws`, {
        auth: { token: agent.accessToken },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        timeout: 8000,
      });
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('agent WS timeout'));
      }, 8000);
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.once('disconnect', () => resolve());
        socket.close();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  });
});
