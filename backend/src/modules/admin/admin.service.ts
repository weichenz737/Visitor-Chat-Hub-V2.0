import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationLogService, LogContext } from './operation-log.service';
import { QuickReplyService } from '../quick-reply/quick-reply.service';
import { LoginLogService } from './login-log.service';
import { enrichMessagesWithSenderNames } from '../../common/utils/message-sender.util';
import { TENANT_AUTH_DEFAULTS } from '../../common/services/tenant-authorization.service';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(date: Date) {
  return date.toISOString().slice(5, 10);
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
    private readonly quickReplyService: QuickReplyService,
    private readonly loginLogService: LoginLogService,
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
    updatedAt: true,
    _count: { select: { agents: true, users: true, sessions: true } },
  } as const;

  private async resolveTenant(tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantCode },
      select: { id: true, tenantCode: true, name: true, status: true },
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    return tenant;
  }

  async getDashboard() {
    const today = startOfToday();
    const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 86400000));

    const [
      tenantCount,
      activeTenantCount,
      suspendedTenantCount,
      totalAgents,
      onlineAgents,
      totalUsers,
      todayUsers,
      todaySessions,
      todayMessages,
      recentTenants,
      recentLogs,
      recentSessions,
      recentAgents,
      onlineUsers,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { status: 'ONLINE', accountStatus: 'ACTIVE' } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.session.count({ where: { createdAt: { gte: today } } }),
      this.prisma.message.count({ where: { createdAt: { gte: today } } }),
      this.prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: this.tenantSelect,
      }),
      this.prisma.operationLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.session.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nickname: true } },
          agent: { select: { name: true } },
          tenant: { select: { name: true, tenantCode: true } },
        },
      }),
      this.prisma.agent.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          tenant: { select: { name: true, tenantCode: true } },
        },
      }),
      this.prisma.session.count({
        where: { status: { in: ['WAITING', 'ACTIVE'] } },
      }),
    ]);

    const activeSessions = onlineUsers;

    const closedToday = await this.prisma.session.findMany({
      where: { closedAt: { gte: today } },
      select: { createdAt: true, closedAt: true },
    });

    let avgSessionDuration = 0;
    if (closedToday.length) {
      const total = closedToday.reduce((sum, s) => {
        if (!s.closedAt) return sum;
        return sum + (s.closedAt.getTime() - s.createdAt.getTime());
      }, 0);
      avgSessionDuration = Math.round(total / closedToday.length / 1000);
    }

    const todayMessagesList = await this.prisma.message.findMany({
      where: { createdAt: { gte: today } },
      select: { createdAt: true, senderType: true, sessionId: true },
      take: 2000,
    });

    const hourlyTrend = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      count: 0,
    }));
    todayMessagesList.forEach((m) => {
      const h = m.createdAt.getHours();
      hourlyTrend[h].count += 1;
    });

    const sessions7d = await this.prisma.session.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });
    const users7d = await this.prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      return d;
    });

    const sessionTrend = last7Days.map((d) => ({
      date: dayLabel(d),
      count: sessions7d.filter(
        (s) => startOfDay(s.createdAt).getTime() === d.getTime(),
      ).length,
    }));

    const userTrend = last7Days.map((d) => ({
      date: dayLabel(d),
      count: users7d.filter(
        (u) => startOfDay(u.createdAt).getTime() === d.getTime(),
      ).length,
    }));

    const agentWorkload = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: {
        senderType: 'AGENT',
        senderId: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const agentIds = agentWorkload
      .map((a) => a.senderId)
      .filter((id): id is string => !!id);
    const agentsMap = agentIds.length
      ? Object.fromEntries(
          (
            await this.prisma.agent.findMany({
              where: { id: { in: agentIds } },
              select: { id: true, name: true, tenant: { select: { name: true } } },
            })
          ).map((a) => [a.id, a]),
        )
      : {};

    const topAgents = agentWorkload
      .filter((row) => row.senderId)
      .map((row) => ({
        name: agentsMap[row.senderId!]?.name ?? '未知',
        tenantName: agentsMap[row.senderId!]?.tenant?.name ?? '-',
        count: row._count.id,
      }));

    const tenantSessions = await this.prisma.session.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const tenantIds = tenantSessions.map((t) => t.tenantId);
    const tenantsMap = tenantIds.length
      ? Object.fromEntries(
          (
            await this.prisma.tenant.findMany({
              where: { id: { in: tenantIds } },
              select: { id: true, name: true, tenantCode: true },
            })
          ).map((t) => [t.id, t]),
        )
      : {};

    const topTenants = tenantSessions.map((row) => ({
      name: tenantsMap[row.tenantId]?.name ?? '未知',
      tenantCode: tenantsMap[row.tenantId]?.tenantCode ?? '-',
      count: row._count.id,
    }));

    const agentMessages = todayMessagesList.filter((m) => m.senderType === 'AGENT');
    const userMessages = todayMessagesList.filter((m) => m.senderType === 'USER');

    let avgResponseTime = 0;
    const responseTimes: number[] = [];
    const userBySession = new Map<string, Date[]>();
    userMessages.forEach((m) => {
      const list = userBySession.get(m.sessionId) ?? [];
      list.push(m.createdAt);
      userBySession.set(m.sessionId, list);
    });
    agentMessages.forEach((m) => {
      const users = userBySession.get(m.sessionId);
      if (!users?.length) return;
      const lastUser = users[users.length - 1];
      if (lastUser < m.createdAt) {
        responseTimes.push(m.createdAt.getTime() - lastUser.getTime());
      }
    });
    if (responseTimes.length) {
      avgResponseTime = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000,
      );
    }

    return {
      stats: {
        tenantCount,
        activeTenantCount,
        suspendedTenantCount,
        totalAgents,
        onlineAgents,
        totalUsers,
        onlineUsers,
        todayUsers,
        todaySessions,
        todayMessages,
        activeSessions,
        avgResponseTime,
        avgSessionDuration,
      },
      charts: {
        todayMessageTrend: hourlyTrend,
        sessionTrend7d: sessionTrend,
        userTrend7d: userTrend,
        topAgents,
        topTenants,
      },
      recentTenants,
      recentAgents,
      recentLogs,
      recentSessions,
    };
  }

  async listTenants(query: {
    page?: number;
    limit?: number;
    keyword?: string;
    status?: TenantStatus;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword, mode: 'insensitive' } },
        { tenantCode: { contains: query.keyword, mode: 'insensitive' } },
        { slug: { contains: query.keyword, mode: 'insensitive' } },
        { adminEmail: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.TenantOrderByWithRelationInput = {};
    const field = query.sortField ?? 'createdAt';
    const order = query.sortOrder ?? 'desc';
    if (['name', 'slug', 'tenantCode', 'status', 'createdAt', 'adminEmail'].includes(field)) {
      orderBy[field as keyof Prisma.TenantOrderByWithRelationInput] = order;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: this.tenantSelect,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getTenant(tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantCode },
      select: this.tenantSelect,
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    return tenant;
  }

  async createTenant(
    data: {
      name: string;
      tenantCode: string;
      slug: string;
      adminEmail: string;
      adminPassword: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
    },
    ctx: LogContext,
  ) {
    const exists = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ tenantCode: data.tenantCode }, { slug: data.slug }],
      },
    });
    if (exists) {
      throw new BadRequestException('企业编码或 Slug 已存在');
    }

    const apiKey = `cs_${randomBytes(24).toString('hex')}`;
    const hashed = await bcrypt.hash(data.adminPassword, 10);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          tenantCode: data.tenantCode,
          name: data.name,
          slug: data.slug,
          adminEmail: data.adminEmail,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          remark: data.remark,
          apiKey,
        },
      });

      await tx.agent.create({
        data: {
          tenantId: created.id,
          email: data.adminEmail,
          password: hashed,
          name: data.contactName ?? '管理员',
          role: 'TENANT_ADMIN',
        },
      });

      return tx.tenant.findUnique({
        where: { id: created.id },
        select: this.tenantSelect,
      });
    });

    await this.operationLog.create(
      ctx,
      '新增租户',
      tenant!.name,
      `tenantCode=${tenant!.tenantCode}`,
    );

    return tenant!;
  }

  async updateTenant(
    tenantCode: string,
    data: {
      name?: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
      status?: TenantStatus;
      domain?: string;
    },
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const tenant = await this.prisma.tenant.update({
      where: { id: resolved.id },
      data,
      select: this.tenantSelect,
    });

    await this.operationLog.create(ctx, '编辑租户', tenant.name, JSON.stringify(data));
    return tenant;
  }

  async updateTenantStatus(
    tenantCode: string,
    status: TenantStatus,
    ctx: LogContext,
  ) {
    const tenant = await this.updateTenant(tenantCode, { status }, ctx);
    const action =
      status === 'ACTIVE' ? '启用租户' : status === 'SUSPENDED' ? '冻结租户' : '停用租户';
    await this.operationLog.create(ctx, action, tenant.name);
    return tenant;
  }

  async deleteTenant(tenantCode: string, ctx: LogContext) {
    const tenant = await this.getTenant(tenantCode);
    if (tenant._count.agents > 0) {
      throw new BadRequestException('请先删除全部客服');
    }

    const resolved = await this.resolveTenant(tenantCode);
    await this.prisma.tenant.delete({ where: { id: resolved.id } });
    await this.operationLog.create(ctx, '删除租户', tenant.name);
    return { ok: true };
  }

  async regenerateApiKey(tenantCode: string, ctx: LogContext) {
    const resolved = await this.resolveTenant(tenantCode);
    const apiKey = `cs_${randomBytes(24).toString('hex')}`;
    const tenant = await this.prisma.tenant.update({
      where: { id: resolved.id },
      data: { apiKey },
      select: this.tenantSelect,
    });
    await this.operationLog.create(ctx, '重新生成API Key', tenant.name);
    return tenant;
  }

  async listTenantAgents(
    tenantCode: string,
    query: { page?: number; limit?: number; keyword?: string; accountStatus?: string },
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AgentWhereInput = { tenantId: resolved.id };
    if (query.accountStatus) {
      where.accountStatus = query.accountStatus as 'ACTIVE' | 'SUSPENDED';
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
          remark: true,
          role: true,
          accountStatus: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              sessions: { where: { status: { in: ['WAITING', 'ACTIVE'] } } },
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        ...a,
        activeSessionCount: a._count.sessions,
        _count: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async listAllAgents(query: {
    page?: number;
    limit?: number;
    keyword?: string;
    tenantCode?: string;
    agentId?: string;
    status?: 'ONLINE' | 'OFFLINE' | 'ACTIVE' | 'SUSPENDED';
    onlineOnly?: boolean;
    suspendedOnly?: boolean;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AgentWhereInput = {};
    if (query.agentId) where.id = query.agentId;
    if (query.tenantCode) {
      where.tenant = { tenantCode: query.tenantCode };
    }
    if (query.status === 'ONLINE' || query.status === 'OFFLINE') {
      where.status = query.status;
    } else if (query.status === 'ACTIVE' || query.status === 'SUSPENDED') {
      where.accountStatus = query.status;
    } else {
      if (query.onlineOnly) where.status = 'ONLINE';
      if (query.suspendedOnly) where.accountStatus = 'SUSPENDED';
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
        include: {
          tenant: { select: { tenantCode: true, name: true } },
          _count: {
            select: {
              sessions: { where: { status: { in: ['WAITING', 'ACTIVE'] } } },
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      items: items.map(({ _count, password: _, ...a }) => ({
        ...a,
        activeSessionCount: _count.sessions,
      })),
      total,
      page,
      limit,
    };
  }

  async createAgent(
    tenantCode: string,
    data: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const hashed = await bcrypt.hash(data.password, 10);
    const agent = await this.prisma.agent.create({
      data: {
        tenantId: resolved.id,
        email: data.email,
        password: hashed,
        name: data.name,
        phone: data.phone,
        remark: data.remark,
        role: data.role ?? 'AGENT',
        accountStatus: data.accountStatus ?? 'ACTIVE',
      },
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
    });

    await this.operationLog.create(ctx, '新增客服', data.name, `tenantCode=${tenantCode}`);
    return agent;
  }

  async updateAgent(
    tenantCode: string,
    agentId: string,
    data: {
      name?: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId: resolved.id },
    });
    if (!agent) throw new NotFoundException('客服不存在');

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data,
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
    });

    await this.operationLog.create(ctx, '编辑客服', updated.name, JSON.stringify(data));
    return updated;
  }

  async resetAgentPassword(
    tenantCode: string,
    agentId: string,
    password: string,
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId: resolved.id },
    });
    if (!agent) throw new NotFoundException('客服不存在');

    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { password: hashed },
    });

    await this.operationLog.create(ctx, '重置客服密码', agent.name);
    return { ok: true };
  }

  async deleteAgent(tenantCode: string, agentId: string, ctx: LogContext) {
    const resolved = await this.resolveTenant(tenantCode);
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId: resolved.id },
      include: {
        _count: {
          select: {
            sessions: { where: { status: { in: ['WAITING', 'ACTIVE'] } } },
          },
        },
      },
    });
    if (!agent) throw new NotFoundException('客服不存在');
    if (agent._count.sessions > 0) {
      throw new BadRequestException('该客服正在服务用户，请先结束全部会话');
    }

    await this.prisma.agent.delete({ where: { id: agentId } });
    await this.operationLog.create(ctx, '删除客服', agent.name);
    return { ok: true };
  }

  async listSessions(query: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'CLOSED' | 'WAITING' | 'current';
    tenantCode?: string;
    keyword?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SessionWhereInput = {};
    if (query.tenantCode) {
      const resolved = await this.resolveTenant(query.tenantCode);
      where.tenantId = resolved.id;
    }
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
          tenant: { select: { tenantCode: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.session.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getSessionMessages(sessionId: string, page = 1, limit = 50) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { nickname: true, visitorNo: true } },
        agent: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundException('会话不存在');

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { sessionId } }),
    ]);

    const enrichedMessages = await enrichMessagesWithSenderNames(
      this.prisma,
      session.tenantId,
      messages,
      { userNickname: session.user.nickname, visitorNo: session.user.visitorNo },
    );

    return { session, messages: enrichedMessages, total, page, limit };
  }

  async listTenantQuickReplies(tenantCode: string) {
    const resolved = await this.resolveTenant(tenantCode);
    return this.quickReplyService.listTenantShared(resolved.id);
  }

  async createTenantQuickReply(
    tenantCode: string,
    data: { title: string; content: string; shortcut?: string },
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const item = await this.quickReplyService.createTenantShared(
      resolved.id,
      data,
    );
    await this.operationLog.create(
      ctx,
      '新增企业常用语',
      data.title,
      `tenantCode=${tenantCode}`,
    );
    return item;
  }

  async updateTenantQuickReply(
    tenantCode: string,
    id: string,
    data: { title?: string; content?: string; shortcut?: string },
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const item = await this.quickReplyService.updateTenantShared(
      resolved.id,
      id,
      data,
    );
    await this.operationLog.create(
      ctx,
      '编辑企业常用语',
      item.title,
      `tenantCode=${tenantCode}`,
    );
    return item;
  }

  async deleteTenantQuickReply(
    tenantCode: string,
    id: string,
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    const items = await this.quickReplyService.listTenantShared(resolved.id);
    const target = items.find((i) => i.id === id);
    await this.quickReplyService.removeTenantShared(resolved.id, id);
    await this.operationLog.create(
      ctx,
      '删除企业常用语',
      target?.title,
      `tenantCode=${tenantCode}`,
    );
    return { ok: true };
  }

  async listLoginLogs(query: {
    page?: number;
    limit?: number;
    keyword?: string;
    success?: boolean;
  }) {
    return this.loginLogService.list(query);
  }

  private tenantSettingDefaults: Record<string, string> = {
    welcomeMessage: '您好，欢迎咨询，请问有什么可以帮您？',
    chatColor: '#4338ca',
    maxFileSizeMb: '10',
    allowedFileTypes: 'image/*,video/*,.pdf,.doc,.docx',
    sessionTimeoutMinutes: '30',
    assignmentStrategy: 'idle_first',
    ...TENANT_AUTH_DEFAULTS,
  };

  async getTenantSettings(tenantCode: string) {
    const resolved = await this.resolveTenant(tenantCode);
    const rows = await this.prisma.tenantSetting.findMany({
      where: { tenantId: resolved.id },
    });
    const map: Record<string, string> = { ...this.tenantSettingDefaults };
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return map;
  }

  async updateTenantSettings(
    tenantCode: string,
    data: Record<string, string>,
    ctx: LogContext,
  ) {
    const resolved = await this.resolveTenant(tenantCode);
    for (const [key, value] of Object.entries(data)) {
      if (!(key in this.tenantSettingDefaults)) continue;
      await this.prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId: resolved.id, key } },
        create: { tenantId: resolved.id, key, value },
        update: { value },
      });
    }
    await this.operationLog.create(
      ctx,
      '更新租户设置',
      resolved.name,
      `tenantCode=${tenantCode}`,
    );
    return this.getTenantSettings(tenantCode);
  }

  async getSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return {
      siteName: map.siteName ?? '企业级 SaaS 客服系统',
      sdkBaseUrl: map.sdkBaseUrl ?? 'http://localhost:5176',
      supportEmail: map.supportEmail ?? 'support@example.com',
      copyright: map.copyright ?? '',
      icpNumber: map.icpNumber ?? '',
      maxImageMb: map.maxImageMb ?? '5',
      maxVideoMb: map.maxVideoMb ?? '50',
      maxFileMb: map.maxFileMb ?? '20',
      allowedExtensions: map.allowedExtensions ?? 'jpg,png,gif,mp4,pdf,doc,docx',
      defaultWelcome: map.defaultWelcome ?? '您好，欢迎咨询！',
      offlineTip: map.offlineTip ?? '客服暂时离线，请留言',
      queueTip: map.queueTip ?? '正在排队，请稍候',
      sessionTimeoutMinutes: map.sessionTimeoutMinutes ?? '30',
      autoCloseMinutes: map.autoCloseMinutes ?? '60',
      assignmentStrategy: map.assignmentStrategy ?? 'idle_first',
      passwordMinLength: map.passwordMinLength ?? '6',
      loginFailLimit: map.loginFailLimit ?? '5',
      tokenExpireDays: map.tokenExpireDays ?? '7',
      ...map,
    };
  }

  async updateSettings(
    data: Record<string, string>,
    ctx: LogContext,
  ) {
    for (const [key, value] of Object.entries(data)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await this.operationLog.create(ctx, '更新系统设置', undefined, JSON.stringify(data));
    return this.getSettings();
  }
}
