import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuickReplyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, agentId?: string) {
    return this.prisma.quickReply.findMany({
      where: {
        tenantId,
        OR: [{ agentId: null }, ...(agentId ? [{ agentId }] : [])],
      },
      orderBy: [{ agentId: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        agentId: true,
        createdAt: true,
      },
    });
  }

  async listTenantShared(tenantId: string) {
    return this.prisma.quickReply.findMany({
      where: { tenantId, agentId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        createdAt: true,
      },
    });
  }

  async createPersonal(
    tenantId: string,
    agentId: string,
    data: { title: string; content: string; shortcut?: string },
  ) {
    return this.prisma.quickReply.create({
      data: { tenantId, agentId, ...data },
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        agentId: true,
        createdAt: true,
      },
    });
  }

  async createTenantShared(
    tenantId: string,
    data: { title: string; content: string; shortcut?: string },
  ) {
    return this.prisma.quickReply.create({
      data: { tenantId, ...data },
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        createdAt: true,
      },
    });
  }

  async updatePersonal(
    tenantId: string,
    agentId: string,
    id: string,
    data: { title?: string; content?: string; shortcut?: string },
  ) {
    const item = await this.prisma.quickReply.findFirst({
      where: { id, tenantId, agentId },
    });
    if (!item) throw new NotFoundException('常用语不存在');
    return this.prisma.quickReply.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        agentId: true,
        createdAt: true,
      },
    });
  }

  async updateTenantShared(
    tenantId: string,
    id: string,
    data: { title?: string; content?: string; shortcut?: string },
  ) {
    const item = await this.prisma.quickReply.findFirst({
      where: { id, tenantId, agentId: null },
    });
    if (!item) throw new NotFoundException('常用语不存在');
    return this.prisma.quickReply.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        content: true,
        shortcut: true,
        createdAt: true,
      },
    });
  }

  async removePersonal(tenantId: string, agentId: string, id: string) {
    const item = await this.prisma.quickReply.findFirst({
      where: { id, tenantId, agentId },
    });
    if (!item) throw new ForbiddenException('只能删除自己的常用语');
    return this.prisma.quickReply.delete({ where: { id } });
  }

  async removeTenantShared(tenantId: string, id: string) {
    const item = await this.prisma.quickReply.findFirst({
      where: { id, tenantId, agentId: null },
    });
    if (!item) throw new NotFoundException('常用语不存在');
    return this.prisma.quickReply.delete({ where: { id } });
  }
}
