import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { formatVisitorName, parseUserMetadata } from '../../common/utils/visitor.util';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async nextVisitorNo(tenantId: string) {
    const max = await this.prisma.user.aggregate({
      where: { tenantId },
      _max: { visitorNo: true },
    });
    return (max._max.visitorNo ?? 0) + 1;
  }

  async findById(tenantId: string, userId: string, agentId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        remarks: {
          orderBy: { updatedAt: 'desc' },
          include: { agent: { select: { id: true, name: true } } },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const meta = parseUserMetadata(user.metadata);
    const myRemark = agentId
      ? user.remarks.find((r) => r.agentId === agentId)
      : undefined;

    return {
      ...user,
      displayName: user.nickname,
      visitorLabel: user.originalName ?? user.nickname,
      source: meta.source ?? meta.referer ?? '直接访问',
      referer: meta.referer,
      utm: {
        source: meta.utmSource,
        medium: meta.utmMedium,
        campaign: meta.utmCampaign,
      },
      myRemark: myRemark ?? null,
      allTags: [...new Set(user.remarks.flatMap((r) => r.tags))],
    };
  }

  async updateNickname(tenantId: string, userId: string, nickname: string) {
    const user = await this.findById(tenantId, userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { nickname: nickname.trim() },
      select: {
        id: true,
        nickname: true,
        originalName: true,
        visitorNo: true,
      },
    });
  }

  formatVisitorNo(visitorNo: number) {
    return formatVisitorName(visitorNo);
  }
}
