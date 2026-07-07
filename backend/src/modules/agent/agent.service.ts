import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { validateAgentPassword } from '../../common/utils/visitor.util';

@Injectable()
export class AgentService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.resetStalePresence();
  }

  /** Clear orphaned online flags after process restarts or abnormal disconnects. */
  async resetStalePresence() {
    await this.prisma.agent.updateMany({ data: { status: 'OFFLINE' } });
    const keys = await this.redis.getClient().keys('agent:*:ws_connections');
    if (keys.length) {
      await this.redis.getClient().del(...keys);
    }
  }

  async goOffline(tenantId: string, agentId: string) {
    await this.findById(tenantId, agentId);
    await this.redis.getClient().del(this.redis.agentConnectionsKey(agentId));
    return this.updateStatus(tenantId, agentId, 'OFFLINE');
  }

  private profileSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatar: true,
    agentCode: true,
    role: true,
    status: true,
    createdAt: true,
  } as const;

  async findByTenant(tenantId: string) {
    return this.prisma.agent.findMany({
      where: { tenantId },
      select: this.profileSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      select: this.profileSelect,
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async findByCode(tenantId: string, agentCode: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { tenantId, agentCode },
      select: { ...this.profileSelect, accountStatus: true },
    });
    if (!agent) throw new NotFoundException('客服不存在');
    return agent;
  }

  async generateAgentCode(tenantId: string) {
    const count = await this.prisma.agent.count({ where: { tenantId } });
    return `AG${String(count + 1).padStart(3, '0')}`;
  }

  async create(
    tenantId: string,
    data: { email: string; password: string; name: string; role?: 'AGENT' | 'SUPERVISOR' },
  ) {
    const hashed = await bcrypt.hash(data.password, 10);
    const agentCode = await this.generateAgentCode(tenantId);
    return this.prisma.agent.create({
      data: {
        tenantId,
        email: data.email,
        password: hashed,
        name: data.name,
        role: data.role ?? 'AGENT',
        agentCode,
      },
      select: { ...this.profileSelect, tenantId: true },
    });
  }

  async getProfile(tenantId: string, agentId: string) {
    return this.findById(tenantId, agentId);
  }

  async updateProfile(
    tenantId: string,
    agentId: string,
    data: { name?: string; phone?: string; avatar?: string },
  ) {
    await this.findById(tenantId, agentId);
    return this.prisma.agent.update({
      where: { id: agentId },
      data,
      select: this.profileSelect,
    });
  }

  async changePassword(
    tenantId: string,
    agentId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    if (!(await bcrypt.compare(oldPassword, agent.password))) {
      throw new BadRequestException('原密码不正确');
    }
    validateAgentPassword(newPassword);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { password: hashed },
    });
    return { ok: true };
  }

  async getShareLink(tenantId: string, agentId: string, baseUrl: string) {
    const agent = await this.findById(tenantId, agentId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantCode: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const code = agent.agentCode ?? agent.id.slice(0, 8);
    const url = `${baseUrl.replace(/\/$/, '')}/?tenant=${tenant.tenantCode}&agent=${code}`;
    return {
      url,
      agentCode: code,
      agentName: agent.name,
      tenantCode: tenant.tenantCode,
      tenantName: tenant.name,
    };
  }

  async getStats(tenantId: string, agentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySessions, activeSessions, todayMessages] = await Promise.all([
      this.prisma.session.count({
        where: {
          tenantId,
          agentId,
          createdAt: { gte: today },
        },
      }),
      this.prisma.session.count({
        where: { tenantId, agentId, status: 'ACTIVE' },
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          senderType: 'AGENT',
          senderId: agentId,
          createdAt: { gte: today },
        },
      }),
    ]);

    return { todaySessions, activeSessions, todayMessages };
  }

  async updateStatus(
    tenantId: string,
    agentId: string,
    status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY',
  ) {
    await this.findById(tenantId, agentId);
    await this.redis.getClient().set(this.redis.agentStatusKey(agentId), status);
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { status },
      select: { id: true, name: true, status: true },
    });
  }

  async getOnlineAgents(tenantId: string) {
    return this.prisma.agent.findMany({
      where: {
        tenantId,
        role: 'AGENT',
        status: { in: ['ONLINE', 'BUSY'] },
        accountStatus: 'ACTIVE',
      },
      select: { id: true, name: true, status: true, agentCode: true },
      orderBy: { name: 'asc' },
    });
  }

  async canReceiveAssignment(tenantId: string, agentId: string) {
    const agent = await this.findById(tenantId, agentId);
    return agent.status === 'ONLINE';
  }

  async getVisitorTags(tenantId: string) {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'visitorTags' } },
    });
    const defaults = 'VIP,已成交,售前,售后,投诉,高意向';
    const raw = row?.value ?? defaults;
    return {
      tags: raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    };
  }
}
