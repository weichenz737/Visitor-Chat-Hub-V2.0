import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { toMessageDto } from '../../common/utils/file-message.util';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async getOrCreate(tenantId: string, userId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, nickname: true, originalName: true, visitorNo: true } },
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { tenantId, userId },
      include: {
        user: { select: { id: true, nickname: true, originalName: true, visitorNo: true } },
      },
    });
  }

  async findById(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        user: { select: { id: true, nickname: true, originalName: true, visitorNo: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getOpenSession(conversationId: string) {
    return this.prisma.session.findFirst({
      where: {
        conversationId,
        status: { in: ['WAITING', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async getMine(tenantId: string, userId: string, agentCode?: string) {
    const conversation = await this.getOrCreate(tenantId, userId);
    let currentSession = await this.getOpenSession(conversation.id);

    if (!currentSession) {
      const sessionCount = await this.prisma.session.count({
        where: { conversationId: conversation.id },
      });
      if (sessionCount === 0) {
        currentSession = await this.sessionService.createInConversation(
          tenantId,
          conversation.id,
          userId,
          { agentCode },
        );
      }
    }

    return { ...conversation, currentSession };
  }

  async getLatestSession(conversationId: string) {
    return this.prisma.session.findFirst({
      where: { conversationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
        removedBy: { select: { id: true, name: true } },
      },
    });
  }

  async listForAgent(
    tenantId: string,
    agentId: string,
    query: PaginationDto & { archived?: string },
  ) {
    const { take, skip } = paginate(query.page, query.limit);
    const showArchived = query.archived === '1' || query.archived === 'true';

    const agentAccessFilter = {
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

    const where = {
      tenantId,
      sessions: {
        some: {
          status: { not: 'REMOVED' as const },
          ...agentAccessFilter,
        },
      },
      ...(showArchived
        ? { agentArchives: { some: { agentId } } }
        : { agentArchives: { none: { agentId } } }),
    };
    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        user: { select: { id: true, nickname: true, originalName: true } },
        sessions: {
          where: { status: { not: 'REMOVED' } },
          orderBy: { updatedAt: 'desc' },
          include: {
            agent: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
    });

    const total = await this.prisma.conversation.count({ where });

    const accessibleSessionIds = conversations.flatMap((conv) =>
      conv.sessions
        .filter(
          (s) =>
            s.agentId === agentId ||
            (s.status === 'WAITING' &&
              !s.agentId &&
              (!s.preferredAgentId || s.preferredAgentId === agentId)),
        )
        .map((s) => s.id),
    );
    const unreadBySession = new Map<string, number>();
    if (accessibleSessionIds.length) {
      const unreadRows = await this.prisma.message.groupBy({
        by: ['sessionId'],
        where: {
          tenantId,
          sessionId: { in: accessibleSessionIds },
          senderType: 'USER',
          readAt: null,
        },
        _count: { _all: true },
      });
      for (const row of unreadRows) {
        unreadBySession.set(row.sessionId, row._count._all);
      }
    }

    const items = conversations.map((conv) => {
      const accessibleSessions = conv.sessions.filter(
        (s) =>
          s.agentId === agentId ||
          (s.status === 'WAITING' &&
            !s.agentId &&
            (!s.preferredAgentId || s.preferredAgentId === agentId)),
      );
      const openSession = accessibleSessions.find(
        (s) => s.status === 'WAITING' || s.status === 'ACTIVE',
      );
      const currentSession = openSession ?? accessibleSessions[0] ?? null;
      const lastMessage = accessibleSessions
        .flatMap((s) => s.messages)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

      const unreadCount = accessibleSessions.reduce(
        (sum, s) => sum + (unreadBySession.get(s.id) ?? 0),
        0,
      );

      return {
        id: conv.id,
        userId: conv.userId,
        user: conv.user,
        currentSession: currentSession
          ? {
              id: currentSession.id,
              status: currentSession.status,
              agentId: currentSession.agentId,
              agent: currentSession.agent,
              createdAt: currentSession.createdAt,
              updatedAt: currentSession.updatedAt,
            }
          : null,
        lastMessage: lastMessage ? toMessageDto(lastMessage) : null,
        unreadCount,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    });

    return { items, total, page: query.page, limit: query.limit };
  }

  async assertAgentAccess(
    tenantId: string,
    conversationId: string,
    agentId: string,
  ) {
    const conversation = await this.findById(tenantId, conversationId);
    const accessible = await this.prisma.session.findFirst({
      where: {
        conversationId,
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
      throw new ForbiddenException('无权查看此会话');
    }
    return conversation;
  }

  async markConversationRead(
    tenantId: string,
    conversationId: string,
    agentId: string,
  ) {
    await this.assertAgentAccess(tenantId, conversationId, agentId);
    const sessions = await this.prisma.session.findMany({
      where: {
        tenantId,
        conversationId,
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
      select: { id: true },
    });
    if (!sessions.length) return { updated: 0 };
    const result = await this.prisma.message.updateMany({
      where: {
        tenantId,
        sessionId: { in: sessions.map((s) => s.id) },
        senderType: 'USER',
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async archive(tenantId: string, conversationId: string, agentId: string) {
    await this.assertAgentAccess(tenantId, conversationId, agentId);
    await this.prisma.conversationAgentArchive.upsert({
      where: {
        agentId_conversationId: { agentId, conversationId },
      },
      create: { tenantId, agentId, conversationId },
      update: { archivedAt: new Date() },
    });
    return { success: true };
  }

  async unarchive(tenantId: string, conversationId: string, agentId: string) {
    await this.assertAgentAccess(tenantId, conversationId, agentId);
    await this.prisma.conversationAgentArchive.deleteMany({
      where: { tenantId, agentId, conversationId },
    });
    return { success: true };
  }

  async removeConversation(
    tenantId: string,
    conversationId: string,
    agentId: string,
  ) {
    await this.assertAgentAccess(tenantId, conversationId, agentId);
    const sessions = await this.prisma.session.findMany({
      where: {
        tenantId,
        conversationId,
        status: { not: 'REMOVED' },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!sessions.length) {
      throw new NotFoundException('没有可移除的会话');
    }

    await this.prisma.conversationAgentArchive.deleteMany({
      where: { tenantId, agentId, conversationId },
    });

    const now = new Date();
    await this.prisma.$transaction(
      sessions.map((s) =>
        this.prisma.session.update({
          where: { id: s.id },
          data: {
            status: 'REMOVED',
            removedAt: now,
            removedByAgentId: agentId,
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

    const latest = await this.prisma.session.findFirst({
      where: { conversationId, tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true } },
        agent: { select: { id: true, name: true } },
        removedBy: { select: { id: true, name: true } },
      },
    });
    if (!latest) {
      throw new NotFoundException('没有可移除的会话');
    }
    return { session: latest };
  }
}
