import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.platformAdmin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: '系统管理员',
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { tenantCode: 'demo001' },
    create: {
      tenantCode: 'demo001',
      name: '演示企业',
      slug: 'demo',
      apiKey: 'cs_demo_api_key_12345',
      adminEmail: 'admin@demo.com',
      contactName: '张经理',
      contactPhone: '13800138000',
      remark: '演示租户',
      domain: 'demo.example.com',
    },
  });

  const agentPassword = await bcrypt.hash('agent123', 10);
  const supervisorPassword = await bcrypt.hash('supervisor123', 10);

  await prisma.agent.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' },
    },
    update: { role: 'TENANT_ADMIN', agentCode: 'AG001' },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      password: agentPassword,
      name: '企业管理员',
      phone: '13800138001',
      role: 'TENANT_ADMIN',
      agentCode: 'AG001',
      accountStatus: 'ACTIVE',
      status: 'OFFLINE',
    },
  });

  await prisma.agent.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'supervisor@demo.com' },
    },
    update: { role: 'SUPERVISOR' },
    create: {
      tenantId: tenant.id,
      email: 'supervisor@demo.com',
      password: supervisorPassword,
      name: '客服主管',
      phone: '13800138002',
      role: 'SUPERVISOR',
      accountStatus: 'ACTIVE',
      status: 'OFFLINE',
    },
  });

  await prisma.agent.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'agent@demo.com' },
    },
    update: { role: 'AGENT', agentCode: 'AG002' },
    create: {
      tenantId: tenant.id,
      email: 'agent@demo.com',
      password: agentPassword,
      name: '客服小王',
      phone: '13900139000',
      role: 'AGENT',
      agentCode: 'AG002',
      accountStatus: 'ACTIVE',
      status: 'OFFLINE',
    },
  });

  await prisma.agent.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'agent2@demo.com' },
    },
    update: { role: 'AGENT', agentCode: 'AG003' },
    create: {
      tenantId: tenant.id,
      email: 'agent2@demo.com',
      password: agentPassword,
      name: '客服小李',
      phone: '13900139001',
      role: 'AGENT',
      agentCode: 'AG003',
      accountStatus: 'ACTIVE',
      status: 'OFFLINE',
    },
  });

  const usersNeedNo = await prisma.user.findMany({
    where: { tenantId: tenant.id, visitorNo: null },
  });
  let nextNo =
    (
      await prisma.user.aggregate({
        where: { tenantId: tenant.id },
        _max: { visitorNo: true },
      })
    )._max.visitorNo ?? 0;
  for (const u of usersNeedNo) {
    nextNo += 1;
    const name = `访客${String(nextNo).padStart(6, '0')}`;
    await prisma.user.update({
      where: { id: u.id },
      data: {
        visitorNo: nextNo,
        nickname: u.nickname === '访客' || !u.nickname ? name : u.nickname,
        originalName: name,
        firstSeenAt: u.createdAt,
        lastSeenAt: new Date(),
      },
    });
  }

  await prisma.systemSetting.createMany({
    data: [
      { key: 'siteName', value: '企业级 SaaS 客服系统' },
      { key: 'sdkBaseUrl', value: 'http://localhost:5176' },
      { key: 'supportEmail', value: 'support@example.com' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed:');
  console.log({
    platform: { email: admin.email, password: 'admin123', portal: 'Platform Admin :5175' },
    tenantAdmin: { email: 'admin@demo.com', password: 'agent123', tenantCode: 'demo001', portal: 'Tenant Admin :5177' },
    supervisor: { email: 'supervisor@demo.com', password: 'supervisor123', tenantCode: 'demo001', portal: 'Tenant Admin :5177' },
    agent: { email: 'agent@demo.com', password: 'agent123', tenantCode: 'demo001', portal: 'Agent Workbench :5174' },
    tenant: { name: tenant.name, tenantCode: tenant.tenantCode, apiKey: tenant.apiKey },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
