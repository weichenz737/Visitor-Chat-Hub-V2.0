import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { enrichMessagesWithSenderNames } from '../../common/utils/message-sender.util';

@Injectable()
export class ChatAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async listChatUsers(
    tenantId: string | undefined,
    query: {
      page?: number;
      limit?: number;
      keyword?: string;
      tenantCode?: string;
      startTime?: string;
      endTime?: string;
      sessionStatus?: string;
    },
  ) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && query.tenantCode) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { tenantCode: query.tenantCode },
        select: { id: true },
      });
      if (tenant) resolvedTenantId = tenant.id;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    const where: string[] = [];

    if (resolvedTenantId) {
      params.push(resolvedTenantId);
      where.push(`u.tenant_id = $${params.length}`);
    }
    if (query.keyword) {
      params.push(`%${query.keyword}%`);
      where.push(
        `(u.nickname ILIKE $${params.length} OR CAST(u.visitor_no AS TEXT) ILIKE $${params.length})`,
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const outerWhere: string[] = [];
    if (query.startTime) {
      params.push(new Date(query.startTime));
      outerWhere.push(`cu."lastMessageAt" >= $${params.length}`);
    }
    if (query.endTime) {
      params.push(new Date(query.endTime));
      outerWhere.push(`cu."lastMessageAt" <= $${params.length}`);
    }
    if (query.sessionStatus) {
      params.push(query.sessionStatus);
      outerWhere.push(`cu."latestSessionStatus" = $${params.length}`);
    }
    const outerWhereClause = outerWhere.length
      ? `WHERE ${outerWhere.join(' AND ')}`
      : '';

    const baseSql = `
      SELECT u.id, u.nickname, u.visitor_no AS "visitorNo", u.first_seen_at AS "firstSeenAt",
        u.last_seen_at AS "lastSeenAt", u.tenant_id AS "tenantId",
        COUNT(m.id)::int AS "messageCount",
        COUNT(DISTINCT s.id)::int AS "sessionCount",
        MAX(m.created_at) AS "lastMessageAt",
        (
          SELECT s2.status::text
          FROM sessions s2
          INNER JOIN messages m2 ON m2.session_id = s2.id
          WHERE s2.user_id = u.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS "latestSessionStatus",
        (
          SELECT s2.id
          FROM sessions s2
          INNER JOIN messages m2 ON m2.session_id = s2.id
          WHERE s2.user_id = u.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS "latestSessionId",
        (
          SELECT s2.agent_id
          FROM sessions s2
          INNER JOIN messages m2 ON m2.session_id = s2.id
          WHERE s2.user_id = u.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS "latestSessionAgentId",
        (
          SELECT COALESCE(
            (
              SELECT a.name
              FROM messages m_la
              INNER JOIN sessions s_la ON s_la.id = m_la.session_id
              INNER JOIN agents a ON a.id = m_la.sender_id AND a.tenant_id = m_la.tenant_id
              WHERE s_la.user_id = u.id
                AND m_la.sender_type = 'AGENT'
                AND m_la.sender_id IS NOT NULL
              ORDER BY m_la.created_at DESC
              LIMIT 1
            ),
            (
              SELECT a.name
              FROM sessions s_la
              INNER JOIN messages m_la ON m_la.session_id = s_la.id
              INNER JOIN agents a ON a.id = s_la.agent_id AND a.tenant_id = s_la.tenant_id
              WHERE s_la.user_id = u.id AND s_la.agent_id IS NOT NULL
              ORDER BY m_la.created_at DESC
              LIMIT 1
            )
          )
        ) AS "latestAgentName",
        (
          SELECT STRING_AGG(DISTINCT agent_name, ';' ORDER BY agent_name)
          FROM (
            SELECT a.name AS agent_name
            FROM sessions s_ag
            INNER JOIN agents a ON a.id = s_ag.agent_id AND a.tenant_id = s_ag.tenant_id
            WHERE s_ag.user_id = u.id AND s_ag.agent_id IS NOT NULL
            UNION
            SELECT a.name AS agent_name
            FROM messages m_ag
            INNER JOIN sessions s_ag ON s_ag.id = m_ag.session_id
            INNER JOIN agents a ON a.id = m_ag.sender_id AND a.tenant_id = m_ag.tenant_id
            WHERE s_ag.user_id = u.id
              AND m_ag.sender_type = 'AGENT'
              AND m_ag.sender_id IS NOT NULL
          ) served_agents
        ) AS "agentNames",
        t.tenant_code AS "tenantCode", t.name AS "tenantName"
      FROM users u
      INNER JOIN tenants t ON t.id = u.tenant_id
      INNER JOIN sessions s ON s.user_id = u.id
      INNER JOIN messages m ON m.session_id = s.id
      ${whereClause}
      GROUP BY u.id, t.tenant_code, t.name
    `;

    const countSql = `
      WITH chat_users AS (${baseSql})
      SELECT COUNT(*)::int AS count FROM chat_users cu
      ${outerWhereClause}
    `;

    const listSql = `
      WITH chat_users AS (${baseSql})
      SELECT cu.* FROM chat_users cu
      ${outerWhereClause}
      ORDER BY cu."lastMessageAt" DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      countSql,
      ...params,
    );
    const items = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      listSql,
      ...params,
    );

    return {
      items,
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  async getChatUserMessages(
    tenantId: string | undefined,
    userId: string,
    page = 1,
    limit = 50,
    query: {
      senderType?: 'USER' | 'AGENT' | 'SYSTEM';
      content?: string;
      startTime?: string;
      endTime?: string;
    } = {},
  ) {
    const userWhere: Prisma.UserWhereInput = { id: userId };
    if (tenantId) userWhere.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where: userWhere,
      select: {
        id: true,
        tenantId: true,
        nickname: true,
        visitorNo: true,
        firstSeenAt: true,
        lastSeenAt: true,
        tenant: { select: { tenantCode: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const sessionWhere: Prisma.SessionWhereInput = { userId };
    if (tenantId) sessionWhere.tenantId = tenantId;

    const sessions = await this.prisma.session.findMany({
      where: sessionWhere,
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);

    if (!sessionIds.length) {
      return { user, messages: [], total: 0, page, limit };
    }

    const skip = (page - 1) * limit;
    const messageWhere: Prisma.MessageWhereInput = {
      sessionId: { in: sessionIds },
    };
    if (tenantId) messageWhere.tenantId = tenantId;
    if (query.senderType) messageWhere.senderType = query.senderType;
    if (query.content) {
      messageWhere.OR = [
        { content: { contains: query.content, mode: 'insensitive' } },
        { fileName: { contains: query.content, mode: 'insensitive' } },
      ];
    }
    if (query.startTime || query.endTime) {
      messageWhere.createdAt = {};
      if (query.startTime) {
        messageWhere.createdAt.gte = new Date(query.startTime);
      }
      if (query.endTime) {
        messageWhere.createdAt.lte = new Date(query.endTime);
      }
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: messageWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          session: { select: { id: true, status: true, createdAt: true } },
        },
      }),
      this.prisma.message.count({ where: messageWhere }),
    ]);

    const enrichedMessages = await enrichMessagesWithSenderNames(
      this.prisma,
      tenantId ?? user.tenantId,
      messages,
      { userNickname: user.nickname, visitorNo: user.visitorNo },
    );

    return { user, messages: enrichedMessages, total, page, limit };
  }

  async deleteMessage(tenantId: string | undefined, messageId: string) {
    const where: Prisma.MessageWhereInput = { id: messageId };
    if (tenantId) where.tenantId = tenantId;

    const msg = await this.prisma.message.findFirst({ where });
    if (!msg) throw new NotFoundException('消息不存在');

    const fileRecord = await this.prisma.fileUpload.findFirst({
      where: { messageId },
    });
    if (fileRecord) {
      await this.fileService.delete(tenantId, fileRecord.id);
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    return { success: true };
  }

  async updateMessage(
    tenantId: string | undefined,
    messageId: string,
    data: { content?: string; fileName?: string },
  ) {
    const where: Prisma.MessageWhereInput = { id: messageId };
    if (tenantId) where.tenantId = tenantId;

    const msg = await this.prisma.message.findFirst({
      where,
      include: {
        session: {
          select: {
            userId: true,
            user: { select: { nickname: true, visitorNo: true } },
          },
        },
      },
    });
    if (!msg) throw new NotFoundException('消息不存在');

    if (data.content === undefined && data.fileName === undefined) {
      throw new BadRequestException('请提供要修改的内容');
    }

    const update: Prisma.MessageUpdateInput = {};
    if (data.content !== undefined) {
      const content = data.content.trim();
      if (!content) throw new BadRequestException('消息内容不能为空');
      update.content = content;
    }
    if (data.fileName !== undefined) {
      update.fileName = data.fileName.trim() || null;
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: update,
    });

    const [enriched] = await enrichMessagesWithSenderNames(
      this.prisma,
      msg.tenantId,
      [updated],
      {
        userNickname: msg.session.user.nickname,
        visitorNo: msg.session.user.visitorNo,
      },
    );

    return { message: enriched };
  }

  async deleteChatUserMessages(tenantId: string | undefined, userId: string) {
    const userWhere: Prisma.UserWhereInput = { id: userId };
    if (tenantId) userWhere.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({ where: userWhere });
    if (!user) throw new NotFoundException('用户不存在');

    const sessionWhere: Prisma.SessionWhereInput = { userId };
    if (tenantId) sessionWhere.tenantId = tenantId;

    const sessions = await this.prisma.session.findMany({
      where: sessionWhere,
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) return { deleted: 0 };

    const messageWhere: Prisma.MessageWhereInput = {
      sessionId: { in: sessionIds },
    };
    if (tenantId) messageWhere.tenantId = tenantId;

    const messages = await this.prisma.message.findMany({
      where: messageWhere,
      select: { id: true },
    });
    const messageIds = messages.map((m) => m.id);

    if (messageIds.length) {
      const fileRecords = await this.prisma.fileUpload.findMany({
        where: { messageId: { in: messageIds } },
        select: { id: true },
      });
      for (const f of fileRecords) {
        await this.fileService.delete(tenantId, f.id);
      }
      await this.prisma.message.deleteMany({ where: { id: { in: messageIds } } });
    }

    return { deleted: messageIds.length };
  }
}
