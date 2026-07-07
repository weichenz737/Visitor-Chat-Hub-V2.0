import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentService } from '../agent/agent.service';
import { RedisService } from '../../redis/redis.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';

export type CloseActor = 'USER' | 'AGENT' | 'SYSTEM';
export type CloseReason = 'MANUAL' | 'TIMEOUT' | 'DISCONNECT';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
    private readonly redis: RedisService,
  ) {}

  private async getOfflineBehavior(tenantId: string): Promise<'wait' | 'auto_assign'> {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'agentLinkOfflineBehavior' } },
    });
    return row?.value === 'auto_assign' ? 'auto_assign' : 'wait';
  }

  async getSessionTimeoutMinutes(tenantId: string): Promise<number> {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'sessionTimeoutMinutes' } },
    });
    const minutes = parseInt(row?.value ?? '30', 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  }

  async create(
    tenantId: string,
    userId: string,
    options?: { agentCode?: string; preferredAgentId?: string },
  ) {
    const conversation = await this.getOrCreateConversation(tenantId, userId);
    return this.createInConversation(
      tenantId,
      conversation.id,
      userId,
      options,
    );
  }

  private async getOrCreateConversation(tenantId: string, userId: string) {
    return this.prisma.conversation.upsert({
      where: { userId },
      create: { tenantId, userId },
      update: {},
    });
  }

  async createInConversation(
    tenantId: string,
    conversationId: string,
    userId: string,
    options?: { agentCode?: string; preferredAgentId?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new BadRequestException('租户已冻结，无法创建会话');
    }

    const active = await this.prisma.session.findFirst({
      where: {
        conversationId,
        status: { in: ['WAITING', 'ACTIVE'] },
      },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
      },
    });
    if (active) return active;

    let preferredAgentId = options?.preferredAgentId;
    if (options?.agentCode) {
      const agent = await this.agentService.findByCode(tenantId, options.agentCode);
      preferredAgentId = agent.id;
      if (agent.status === 'ONLINE') {
        const session = await this.prisma.session.create({
          data: {
            tenantId,
            conversationId,
            userId,
            agentId: agent.id,
            preferredAgentId: agent.id,
            status: 'ACTIVE',
          },
          include: {
            user: { select: { id: true, nickname: true } },
            agent: { select: { id: true, name: true } },
          },
        });
        await this.touchConversation(conversationId);
        return session;
      }

      const behavior = await this.getOfflineBehavior(tenantId);
      const session = await this.prisma.session.create({
        data: {
          tenantId,
          conversationId,
          userId,
          preferredAgentId: agent.id,
          status: 'WAITING',
        },
        include: {
          user: { select: { id: true, nickname: true } },
          agent: { select: { id: true, name: true } },
        },
      });
      await this.touchConversation(conversationId);

      if (behavior === 'auto_assign') {
        return this.autoAssign(tenantId, session.id);
      }
      return session;
    }

    const session = await this.prisma.session.create({
      data: {
        tenantId,
        conversationId,
        userId,
        status: 'WAITING',
        preferredAgentId,
      },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
      },
    });
    await this.touchConversation(conversationId);
    return session;
  }

  private async touchConversation(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async resolveSessionForMessage(
    tenantId: string,
    sessionId: string,
    senderType: 'USER' | 'AGENT' | 'SYSTEM',
  ) {
    const session = await this.findById(tenantId, sessionId);
    if (session.status !== 'CLOSED' && session.status !== 'REMOVED') return session;

    if (senderType !== 'USER') {
      throw new BadRequestException('会话已结束，无法发送消息');
    }

    return this.createInConversation(
      tenantId,
      session.conversationId,
      session.userId,
    );
  }

  async findById(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        user: { select: { id: true, nickname: true, deviceId: true } },
        agent: { select: { id: true, name: true, status: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async listForAgent(tenantId: string, agentId: string, query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const where = {
      tenantId,
      OR: [
        { agentId },
        {
          status: 'WAITING' as const,
          agentId: null,
          OR: [
            { preferredAgentId: null },
            { preferredAgentId: agentId },
          ],
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, originalName: true } },
          agent: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.session.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async listForUser(tenantId: string, userId: string) {
    return this.prisma.session.findMany({
      where: { tenantId, userId },
      include: {
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async assignAgent(tenantId: string, sessionId: string, agentId: string) {
    const session = await this.findById(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new BadRequestException('会话已结束');
    }
    if (session.status === 'REMOVED') {
      throw new BadRequestException('会话已移除');
    }
    await this.agentService.findById(tenantId, agentId);

    return this.prisma.session.update({
      where: { id: sessionId },
      data: { agentId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async autoAssign(tenantId: string, sessionId: string) {
    const onlineAgents = await this.agentService.getOnlineAgents(tenantId);
    const available = onlineAgents.filter((a) => a.status === 'ONLINE');
    if (!available.length) return this.findById(tenantId, sessionId);

    const loads = await Promise.all(
      available.map(async (agent) => {
        const count = await this.prisma.session.count({
          where: { tenantId, agentId: agent.id, status: 'ACTIVE' },
        });
        return { agent, count };
      }),
    );
    loads.sort((a, b) => a.count - b.count);
    return this.assignAgent(tenantId, sessionId, loads[0].agent.id);
  }

  async close(
    tenantId: string,
    sessionId: string,
    options: {
      closedBy: CloseActor;
      closedReason: CloseReason;
      actorId?: string;
    },
  ) {
    const session = await this.findById(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new BadRequestException('会话已结束');
    }
    if (session.status === 'REMOVED') {
      throw new BadRequestException('会话已移除');
    }

    if (options.closedBy === 'USER') {
      if (session.userId !== options.actorId) {
        throw new ForbiddenException('无权结束此会话');
      }
    } else if (options.closedBy === 'AGENT') {
      if (!session.agentId || session.agentId !== options.actorId) {
        throw new ForbiddenException('无权结束此会话');
      }
    }

    const now = new Date();
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedBy: options.closedBy,
        closedReason: options.closedReason,
      },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    await this.touchConversation(session.conversationId);

    return { session: updated };
  }

  async remove(
    tenantId: string,
    sessionId: string,
    agentId: string,
  ) {
    const session = await this.findById(tenantId, sessionId);
    if (session.status === 'REMOVED') {
      throw new BadRequestException('会话已移除');
    }

    const accessible = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        tenantId,
        OR: [
          { agentId },
          {
            status: 'WAITING',
            agentId: null,
            OR: [
              { preferredAgentId: null },
              { preferredAgentId: agentId },
            ],
          },
        ],
      },
    });
    if (!accessible) {
      throw new ForbiddenException('无权移除此会话');
    }

    const now = new Date();
    const data: {
      status: 'REMOVED';
      removedAt: Date;
      removedByAgentId: string;
      closedAt?: Date;
      closedBy?: 'AGENT';
      closedReason?: 'MANUAL';
    } = {
      status: 'REMOVED',
      removedAt: now,
      removedByAgentId: agentId,
    };
    if (session.status !== 'CLOSED') {
      data.closedAt = now;
      data.closedBy = 'AGENT';
      data.closedReason = 'MANUAL';
    }

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data,
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
        removedBy: { select: { id: true, name: true } },
      },
    });

    await this.touchConversation(session.conversationId);
    return { session: updated };
  }

  async updateStatus(
    tenantId: string,
    sessionId: string,
    status: 'WAITING' | 'ACTIVE' | 'CLOSED',
  ) {
    if (status === 'CLOSED') {
      throw new BadRequestException('请使用结束会话接口');
    }
    await this.findById(tenantId, sessionId);
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { status },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async closeTimedOutSessions(): Promise<
    Array<{
      tenantId: string;
      session: Awaited<ReturnType<SessionService['close']>>['session'];
    }>
  > {
    const openSessions = await this.prisma.session.findMany({
      where: { status: { in: ['WAITING', 'ACTIVE'] } },
      select: {
        id: true,
        tenantId: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const timeoutCache = new Map<string, number>();
    const closed: Array<{
      tenantId: string;
      session: Awaited<ReturnType<SessionService['close']>>['session'];
    }> = [];

    for (const s of openSessions) {
      let timeoutMin = timeoutCache.get(s.tenantId);
      if (timeoutMin === undefined) {
        timeoutMin = await this.getSessionTimeoutMinutes(s.tenantId);
        timeoutCache.set(s.tenantId, timeoutMin);
      }

      const lastActivity = s.messages[0]?.createdAt ?? s.createdAt;
      const idleMs = Date.now() - lastActivity.getTime();
      if (idleMs < timeoutMin * 60 * 1000) continue;

      try {
        const result = await this.close(s.tenantId, s.id, {
          closedBy: 'SYSTEM',
          closedReason: 'TIMEOUT',
        });
        closed.push({ tenantId: s.tenantId, ...result });
      } catch {
        // skip races / already closed
      }
    }

    return closed;
  }
}
