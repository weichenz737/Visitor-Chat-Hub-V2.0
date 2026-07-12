import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { MessageSenderType, MessageType, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { enrichMessagesWithSenderNames } from '../../common/utils/message-sender.util';
import {
  ALLOWED_UPLOAD_TYPES,
  assertFileMagicMatchesExtension,
} from '../../common/utils/upload-types';
import {
  decodeFileName,
  fixFileNameEncoding,
  toMessageDto,
} from '../../common/utils/file-message.util';

const MEDIA_TYPES: MessageType[] = ['IMAGE', 'VIDEO', 'FILE'];

function assertExtensionMatchesMessageType(
  messageType: MessageType,
  extension: string,
) {
  if (messageType === 'IMAGE') {
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
      throw new BadRequestException('请上传图片文件');
    }
  } else if (messageType === 'VIDEO') {
    if (!['.mp4', '.webm', '.mov'].includes(extension)) {
      throw new BadRequestException('请上传视频文件');
    }
  }
}

@Injectable()
export class ChatAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getGateway(): ChatGateway | null {
    try {
      return this.moduleRef.get(ChatGateway, { strict: false });
    } catch {
      return null;
    }
  }

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
      agentKeyword?: string;
      agentId?: string;
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
    if (query.agentKeyword) {
      params.push(`%${query.agentKeyword}%`);
      outerWhere.push(`(
        COALESCE(cu."latestAgentName", '') ILIKE $${params.length}
        OR COALESCE(cu."agentNames", '') ILIKE $${params.length}
      )`);
    }
    if (query.agentId) {
      params.push(query.agentId);
      outerWhere.push(`(
        cu."latestSessionAgentId" = $${params.length}
        OR EXISTS (
          SELECT 1 FROM sessions s_agf
          WHERE s_agf.user_id = cu.id AND s_agf.agent_id = $${params.length}
        )
        OR EXISTS (
          SELECT 1 FROM messages m_agf
          INNER JOIN sessions s_agf ON s_agf.id = m_agf.session_id
          WHERE s_agf.user_id = cu.id
            AND m_agf.sender_type = 'AGENT'
            AND m_agf.sender_id = $${params.length}
        )
      )`);
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
          SELECT s2.removed_at
          FROM sessions s2
          INNER JOIN messages m2 ON m2.session_id = s2.id
          WHERE s2.user_id = u.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS "removedAt",
        (
          SELECT a.name
          FROM sessions s2
          INNER JOIN messages m2 ON m2.session_id = s2.id
          LEFT JOIN agents a ON a.id = s2.removed_by_agent_id
          WHERE s2.user_id = u.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS "removedByName",
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

    return {
      user,
      messages: enrichedMessages.map((m) => {
        const dto = toMessageDto(m);
        return {
          ...dto,
          // Admin transcript UI historically reads camelCase fields.
          fileName: 'file_name' in dto ? dto.file_name : m.fileName,
          fileSize: 'file_size' in dto ? dto.file_size : m.fileSize,
          senderName: m.senderName,
          session: m.session,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async deleteMessage(tenantId: string | undefined, messageId: string) {
    const where: Prisma.MessageWhereInput = { id: messageId };
    if (tenantId) where.tenantId = tenantId;

    const msg = await this.prisma.message.findFirst({
      where,
      include: {
        session: {
          select: {
            id: true,
            agentId: true,
            preferredAgentId: true,
          },
        },
      },
    });
    if (!msg) throw new NotFoundException('消息不存在');

    const fileRecord = await this.prisma.fileUpload.findFirst({
      where: { messageId, tenantId: msg.tenantId },
    });
    if (fileRecord) {
      await this.fileService.delete(msg.tenantId, fileRecord.id);
    }

    await this.prisma.message.delete({ where: { id: messageId } });

    this.getGateway()?.notifyMessageDeleted(msg.tenantId, {
      sessionId: msg.sessionId,
      messageId: msg.id,
      agentId: msg.session.agentId,
      preferredAgentId: msg.session.preferredAgentId,
    });

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
            id: true,
            agentId: true,
            preferredAgentId: true,
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

    const isMedia = MEDIA_TYPES.includes(msg.type);
    if (isMedia && data.content !== undefined) {
      throw new BadRequestException(
        '图片/视频/文件请通过重新上传替换，不能直接修改链接',
      );
    }
    if (isMedia && msg.type !== 'FILE' && data.fileName !== undefined) {
      throw new BadRequestException('仅文件消息可修改文件名');
    }
    if (!isMedia && data.fileName !== undefined && data.content === undefined) {
      throw new BadRequestException('文本消息不支持修改文件名');
    }

    const update: Prisma.MessageUpdateInput = {};
    if (data.content !== undefined) {
      const content = data.content.trim();
      if (!content) throw new BadRequestException('消息内容不能为空');
      update.content = content;
    }
    if (data.fileName !== undefined) {
      const displayName = data.fileName.trim() || null;
      update.fileName = displayName;
      if (msg.type === 'FILE') {
        const prevMeta =
          msg.metadata && typeof msg.metadata === 'object' && !Array.isArray(msg.metadata)
            ? { ...(msg.metadata as Record<string, unknown>) }
            : {};
        if (displayName) {
          prevMeta.file_name = displayName;
          prevMeta.filename = displayName;
        } else {
          delete prevMeta.file_name;
          delete prevMeta.filename;
        }
        if (typeof msg.fileSize === 'number' && msg.fileSize > 0) {
          prevMeta.file_size = msg.fileSize;
        }
        update.metadata = prevMeta as Prisma.InputJsonValue;
      }
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: update,
    });

    if (msg.type === 'FILE' && data.fileName !== undefined) {
      const displayName = data.fileName.trim() || null;
      await this.prisma.fileUpload.updateMany({
        where: { messageId: msg.id, tenantId: msg.tenantId },
        data: { fileName: displayName ?? updated.fileName ?? 'file' },
      });
    }

    const [enriched] = await enrichMessagesWithSenderNames(
      this.prisma,
      msg.tenantId,
      [updated],
      {
        userNickname: msg.session.user.nickname,
        visitorNo: msg.session.user.visitorNo,
      },
    );

    const dto = toMessageDto(updated) as unknown as Record<string, unknown>;
    this.getGateway()?.notifyMessageUpdated(
      msg.tenantId,
      {
        id: msg.sessionId,
        agentId: msg.session.agentId,
        preferredAgentId: msg.session.preferredAgentId,
      },
      dto,
    );

    return {
      message: {
        ...toMessageDto(updated),
        fileName: updated.fileName,
        fileSize: updated.fileSize,
        senderName: enriched.senderName,
      },
    };
  }

  async replaceMessageMedia(
    tenantId: string | undefined,
    messageId: string,
    file: Express.Multer.File,
    options: {
      fileName?: string;
      uploaderId: string;
    },
  ) {
    if (!file) throw new BadRequestException('请上传文件');

    const where: Prisma.MessageWhereInput = { id: messageId };
    if (tenantId) where.tenantId = tenantId;

    const msg = await this.prisma.message.findFirst({
      where,
      include: {
        session: {
          select: {
            id: true,
            agentId: true,
            preferredAgentId: true,
            user: { select: { nickname: true, visitorNo: true } },
          },
        },
      },
    });
    if (!msg) throw new NotFoundException('消息不存在');
    if (!MEDIA_TYPES.includes(msg.type)) {
      throw new BadRequestException('仅图片/视频/文件消息支持重新上传');
    }

    const extension = extname(file.originalname).toLowerCase();
    const allowedMimeTypes = ALLOWED_UPLOAD_TYPES[extension];
    if (!allowedMimeTypes?.includes(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型');
    }
    assertExtensionMatchesMessageType(msg.type, extension);

    const now = new Date();
    const filename = `${uuidv4()}${extension}`;
    const relativeDir = `${msg.tenantId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uploadRoot = join(process.cwd(), process.env.UPLOAD_DIR ?? './uploads');
    const absDir = join(uploadRoot, relativeDir);
    if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true });
    const absPath = join(absDir, filename);
    writeFileSync(absPath, file.buffer);

    try {
      assertFileMagicMatchesExtension(absPath, file.originalname);
    } catch {
      try {
        unlinkSync(absPath);
      } catch {
        /* ignore */
      }
      throw new BadRequestException('文件内容与扩展名不匹配');
    }

    const relativePath = `${relativeDir}/${filename}`;
    const displayName =
      decodeFileName(options.fileName) ??
      decodeFileName(file.originalname) ??
      fixFileNameEncoding(file.originalname);

    const baseUrl =
      this.config.get<string>('PUBLIC_API_URL') ??
      process.env.PUBLIC_API_URL ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;

    const oldFiles = await this.prisma.fileUpload.findMany({
      where: { messageId: msg.id, tenantId: msg.tenantId },
      select: { id: true },
    });

    const record = await this.fileService.createRecord({
      tenantId: msg.tenantId,
      uploaderType: MessageSenderType.SYSTEM,
      uploaderId: options.uploaderId,
      fileName: displayName,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: relativePath,
      url: '',
    });

    const fileUrl = `${baseUrl.replace(/\/$/, '')}/files/${record.id}`;
    await this.fileService.updateUrl(record.id, fileUrl);
    await this.prisma.fileUpload.update({
      where: { id: record.id },
      data: { messageId: msg.id },
    });

    const prevMeta =
      msg.metadata && typeof msg.metadata === 'object' && !Array.isArray(msg.metadata)
        ? { ...(msg.metadata as Record<string, unknown>) }
        : {};
    prevMeta.file_name = displayName;
    prevMeta.filename = displayName;
    prevMeta.file_size = file.size;

    const updated = await this.prisma.message.update({
      where: { id: msg.id },
      data: {
        content: fileUrl,
        fileName: displayName,
        fileSize: file.size,
        metadata: prevMeta as Prisma.InputJsonValue,
      },
    });

    for (const old of oldFiles) {
      try {
        await this.fileService.delete(msg.tenantId, old.id);
      } catch {
        /* ignore missing/orphan cleanup errors */
      }
    }

    const [enriched] = await enrichMessagesWithSenderNames(
      this.prisma,
      msg.tenantId,
      [updated],
      {
        userNickname: msg.session.user.nickname,
        visitorNo: msg.session.user.visitorNo,
      },
    );

    this.getGateway()?.notifyMessageUpdated(
      msg.tenantId,
      {
        id: msg.sessionId,
        agentId: msg.session.agentId,
        preferredAgentId: msg.session.preferredAgentId,
      },
      toMessageDto(updated) as unknown as Record<string, unknown>,
    );

    return {
      message: {
        ...toMessageDto(updated),
        fileName: updated.fileName,
        fileSize: updated.fileSize,
        senderName: enriched.senderName,
      },
    };
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
      select: { id: true, agentId: true, preferredAgentId: true },
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
        where: { messageId: { in: messageIds }, tenantId: user.tenantId },
        select: { id: true },
      });
      for (const f of fileRecords) {
        await this.fileService.delete(user.tenantId, f.id);
      }
      await this.prisma.message.deleteMany({ where: { id: { in: messageIds } } });
    }

    this.getGateway()?.notifyMessagesCleared(user.tenantId, sessions);

    return { deleted: messageIds.length };
  }
}
