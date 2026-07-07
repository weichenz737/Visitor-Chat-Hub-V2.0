import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { QuickReplyService } from '../quick-reply/quick-reply.service';
import { AuthPayload } from '../../common/decorators/auth.decorator';
import { enrichMessagesWithSenderNames } from '../../common/utils/message-sender.util';
import {
  TENANT_AUTH_DEFAULTS,
  TenantAuthorizationService,
} from '../../common/services/tenant-authorization.service';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quickReplyService: QuickReplyService,
    private readonly tenantAuth: TenantAuthorizationService,
  ) {}

  private tenantSelect = {
    tenantCode: true,
    name: true,
    slug: true,
    apiKey: true,
    adminEmail: true,
    contactName: true,
    contactPhone: true,
    remark: true,
    domain: true,
    status: true,
    createdAt: true,
    _count: { select: { agents: true, users: true, sessions: true } },
  } as const;

  private tenantSettingDefaults: Record<string, string> = {
    welcomeMessage: '您好，欢迎咨询，请问有什么可以帮您？',
    chatColor: '#4338ca',
    maxFileSizeMb: '10',
    allowedFileTypes: 'image/*,video/*,.pdf,.doc,.docx',
    sessionTimeoutMinutes: '30',
    assignmentStrategy: 'idle_first',
    agentLinkOfflineBehavior: 'wait',
    visitorTags: 'VIP,已成交,售前,售后,投诉,高意向',
    ...TENANT_AUTH_DEFAULTS,
  };

  private async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: this.tenantSelect,
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    return tenant;
  }

  async getDashboard(tenantId: string) {
    const today = startOfToday();
    const tenant = await this.getTenant(tenantId);

    const [
      agentCount,
      onlineAgents,
      userCount,
      todayUsers,
      todaySessions,
      todayMessages,
      activeSessions,
      recentSessions,
      recentAgents,
    ] = await Promise.all([
      this.prisma.agent.count({ where: { tenantId } }),
      this.prisma.agent.count({
        where: { tenantId, status: 'ONLINE', accountStatus: 'ACTIVE' },
      }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.session.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.message.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.session.count({
        where: { tenantId, status: { in: ['WAITING', 'ACTIVE'] } },
      }),
      this.prisma.session.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nickname: true } },
          agent: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.agent.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const agentWorkload = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: {
        tenantId,
        senderType: 'AGENT',
        senderId: { not: null },
        createdAt: { gte: today },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const agentIds = agentWorkload.map((a) => a.senderId!).filter(Boolean);
    const agentsMap = agentIds.length
      ? Object.fromEntries(
          (
            await this.prisma.agent.findMany({
              where: { id: { in: agentIds } },
              select: { id: true, name: true },
            })
          ).map((a) => [a.id, a]),
        )
      : {};

    return {
      tenant,
      stats: {
        agentCount,
        onlineAgents,
        userCount,
        todayUsers,
        todaySessions,
        todayMessages,
        activeSessions,
      },
      topAgentsToday: agentWorkload.map((row) => ({
        name: agentsMap[row.senderId!]?.name ?? '未知',
        count: row._count.id,
      })),
      recentSessions,
      recentAgents,
    };
  }

  async getProfile(tenantId: string) {
    return this.getTenant(tenantId);
  }

  async updateProfile(
    tenantId: string,
    data: {
      name?: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
      domain?: string;
    },
    user: AuthPayload,
  ) {
    if (user.staffRole !== 'TENANT_ADMIN') {
      throw new ForbiddenException('仅企业管理员可修改企业信息');
    }
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: this.tenantSelect,
    });
  }

  async getSettings(tenantId: string) {
    const rows = await this.prisma.tenantSetting.findMany({ where: { tenantId } });
    const map: Record<string, string> = { ...this.tenantSettingDefaults };
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return map;
  }

  async updateSettings(tenantId: string, data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      if (!(key in this.tenantSettingDefaults)) continue;
      await this.prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, value },
        update: { value },
      });
    }
    return this.getSettings(tenantId);
  }

  async regenerateApiKey(tenantId: string, user: AuthPayload) {
    if (user.staffRole !== 'TENANT_ADMIN') {
      throw new ForbiddenException('仅企业管理员可重新生成 API Key');
    }
    const apiKey = `cs_${randomBytes(24).toString('hex')}`;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { apiKey },
      select: this.tenantSelect,
    });
  }

  async listAgents(
    tenantId: string,
    query: { page?: number; limit?: number; keyword?: string; role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN' },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.AgentWhereInput = { tenantId };
    if (query.role) {
      where.role = query.role;
    }
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword, mode: 'insensitive' } },
        { email: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          accountStatus: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    const withCounts = await Promise.all(
      items.map(async (a) => ({
        ...a,
        activeSessionCount: await this.prisma.session.count({
          where: { tenantId, agentId: a.id, status: { in: ['WAITING', 'ACTIVE'] } },
        }),
      })),
    );

    return { items: withCounts, total, page, limit };
  }

  async getAuthorizations(tenantId: string) {
    return this.tenantAuth.getAuthorizations(tenantId);
  }

  async removeVisitorSession(
    tenantId: string,
    userId: string,
    operatorAgentId: string,
  ) {
    await this.tenantAuth.assertAllowDeleteSessions(tenantId);

    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('访客不存在');

    const conversation = await this.prisma.conversation.findFirst({
      where: { tenantId, userId },
    });
    if (!conversation) throw new NotFoundException('会话不存在');

    const sessions = await this.prisma.session.findMany({
      where: { tenantId, conversationId: conversation.id, status: { not: 'REMOVED' } },
    });
    if (!sessions.length) throw new NotFoundException('没有可删除的会话');

    const now = new Date();
    await this.prisma.$transaction(
      sessions.map((s) =>
        this.prisma.session.update({
          where: { id: s.id },
          data: {
            status: 'REMOVED',
            removedAt: now,
            removedByAgentId: operatorAgentId,
            ...(s.status !== 'CLOSED'
              ? {
                  closedAt: now,
                  closedBy: 'AGENT' as const,
                  closedReason: 'MANUAL' as const,
                }
              : {}),
          },
        }),
      ),
    );

    return { removed: sessions.length };
  }

  async createAgent(
    tenantId: string,
    data: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR';
      remark?: string;
    },
    user: AuthPayload,
  ) {
    if (user.staffRole === 'SUPERVISOR' && (data as { role?: string }).role === 'TENANT_ADMIN') {
      throw new ForbiddenException('无权创建企业管理员');
    }
    await this.tenantAuth.assertCanCreateAgent(tenantId);
    const hashed = await bcrypt.hash(data.password, 10);
    const count = await this.prisma.agent.count({ where: { tenantId } });
    const agentCode = `AG${String(count + 1).padStart(3, '0')}`;
    try {
      return await this.prisma.agent.create({
        data: {
          tenantId,
          email: data.email,
          password: hashed,
          name: data.name,
          phone: data.phone,
          remark: data.remark,
          role: data.role ?? 'AGENT',
          agentCode,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
          status: true,
          createdAt: true,
        },
      });
    } catch {
      throw new BadRequestException('账号已存在');
    }
  }

  async updateAgent(
    tenantId: string,
    agentId: string,
    data: {
      name?: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
    user: AuthPayload,
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('客服不存在');
    if (agent.role === 'TENANT_ADMIN' && user.staffRole !== 'TENANT_ADMIN') {
      throw new ForbiddenException('无权修改企业管理员');
    }
    if (data.role === 'TENANT_ADMIN' as never) {
      throw new ForbiddenException('不能将客服提升为企业管理员');
    }

    return this.prisma.agent.update({
      where: { id: agentId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async resetAgentPassword(tenantId: string, agentId: string, password: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('客服不存在');
    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { password: hashed },
    });
    return { ok: true };
  }

  async deleteAgent(tenantId: string, agentId: string, user: AuthPayload) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      include: { _count: { select: { sessions: true } } },
    });
    if (!agent) throw new NotFoundException('客服不存在');
    if (agent.role === 'TENANT_ADMIN') {
      throw new ForbiddenException('不能删除企业管理员');
    }
    if (agent.id === user.sub) {
      throw new ForbiddenException('不能删除自己');
    }
    const active = await this.prisma.session.count({
      where: { tenantId, agentId, status: { in: ['WAITING', 'ACTIVE'] } },
    });
    if (active > 0) throw new BadRequestException('请先结束该客服的全部会话');

    await this.prisma.agent.delete({ where: { id: agentId } });
    return { ok: true };
  }

  async listSessions(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      keyword?: string;
      status?: 'ACTIVE' | 'CLOSED' | 'WAITING' | 'REMOVED' | 'current';
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SessionWhereInput = { tenantId };
    if (query.status === 'current') {
      where.status = { in: ['WAITING', 'ACTIVE'] };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.keyword) {
      where.OR = [
        { user: { nickname: { contains: query.keyword, mode: 'insensitive' } } },
        { agent: { name: { contains: query.keyword, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true } },
          agent: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.session.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getSessionMessages(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        user: { select: { nickname: true, visitorNo: true } },
        agent: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundException('会话不存在');

    const messages = await this.prisma.message.findMany({
      where: { sessionId, tenantId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const enrichedMessages = await enrichMessagesWithSenderNames(
      this.prisma,
      tenantId,
      messages,
      { userNickname: session.user.nickname, visitorNo: session.user.visitorNo },
    );

    return { session, messages: enrichedMessages, total: enrichedMessages.length };
  }

  listQuickReplies(tenantId: string) {
    return this.quickReplyService.listTenantShared(tenantId);
  }

  createQuickReply(
    tenantId: string,
    data: { title: string; content: string; shortcut?: string },
  ) {
    return this.quickReplyService.createTenantShared(tenantId, data);
  }

  updateQuickReply(
    tenantId: string,
    id: string,
    data: { title?: string; content?: string; shortcut?: string },
  ) {
    return this.quickReplyService.updateTenantShared(tenantId, id, data);
  }

  deleteQuickReply(tenantId: string, id: string) {
    return this.quickReplyService.removeTenantShared(tenantId, id);
  }
}
