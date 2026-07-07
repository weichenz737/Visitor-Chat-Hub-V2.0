import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';

@Injectable()
export class RemarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async upsertForAgent(
    tenantId: string,
    userId: string,
    agentId: string,
    data: { content: string; tags?: string[] },
  ) {
    await this.userService.findById(tenantId, userId);
    return this.prisma.remark.upsert({
      where: {
        tenantId_userId_agentId: { tenantId, userId, agentId },
      },
      create: {
        tenantId,
        userId,
        agentId,
        content: data.content,
        tags: data.tags ?? [],
      },
      update: {
        content: data.content,
        tags: data.tags ?? [],
      },
      include: { agent: { select: { id: true, name: true } } },
    });
  }

  async create(
    tenantId: string,
    userId: string,
    agentId: string,
    data: { content: string; tags?: string[] },
  ) {
    return this.upsertForAgent(tenantId, userId, agentId, data);
  }

  async update(
    tenantId: string,
    remarkId: string,
    data: { content?: string; tags?: string[] },
  ) {
    const remark = await this.prisma.remark.findFirst({
      where: { id: remarkId, tenantId },
    });
    if (!remark) throw new NotFoundException('Remark not found');

    return this.prisma.remark.update({
      where: { id: remarkId },
      data,
      include: { agent: { select: { id: true, name: true } } },
    });
  }

  async getByAgent(tenantId: string, userId: string, agentId: string) {
    return this.prisma.remark.findUnique({
      where: {
        tenantId_userId_agentId: { tenantId, userId, agentId },
      },
      include: { agent: { select: { id: true, name: true } } },
    });
  }

  async listByUser(tenantId: string, userId: string) {
    await this.userService.findById(tenantId, userId);
    return this.prisma.remark.findMany({
      where: { tenantId, userId },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
