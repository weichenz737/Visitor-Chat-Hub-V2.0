import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MessageSenderType, MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { FileService } from '../file/file.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import {
  decodeFileName,
  readMetaString,
  toMessageDto,
} from '../../common/utils/file-message.util';
import { SessionAuthorizationService } from '../session/session-authorization.service';
import type { AppRole } from '../../common/decorators/auth.decorator';

export interface CreateMessageDto {
  sessionId: string;
  senderType: MessageSenderType;
  senderId?: string;
  type?: MessageType;
  content: string;
  fileName?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly sessionAuthorization: SessionAuthorizationService,
    private readonly fileService: FileService,
  ) {}

  private validateMessagePayload(dto: CreateMessageDto) {
    const type = dto.type ?? 'TEXT';
    const content = dto.content?.trim();
    if (!content) throw new BadRequestException('消息内容不能为空');

    if (content.startsWith('data:')) {
      throw new BadRequestException('消息内容不能包含 data URI');
    }
    if (/;base64,/i.test(content) || /base64,/i.test(content.slice(0, 200))) {
      throw new BadRequestException('消息内容不能包含 base64 内嵌数据');
    }

    if (type === 'TEXT') {
      if (content.length > 10_000) {
        throw new BadRequestException('文本消息过长');
      }
    } else {
      if (content.length > 2_048) {
        throw new BadRequestException('文件消息必须使用有效 URL');
      }
      try {
        const url = new URL(content);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Unsupported protocol');
        }
      } catch {
        throw new BadRequestException('文件消息必须使用 HTTP(S) URL');
      }
    }

    if (
      dto.metadata &&
      JSON.stringify(dto.metadata).length > 16 * 1024
    ) {
      throw new BadRequestException('消息 metadata 过大');
    }
  }

  private async assertUploadedFile(
    tenantId: string,
    dto: CreateMessageDto,
  ) {
    const type = dto.type ?? 'TEXT';
    if (type === 'TEXT') return;
    const fileId = this.extractFileIdFromContent(dto.content);
    const upload = await this.prisma.fileUpload.findFirst({
      where: {
        tenantId,
        OR: [
          { url: dto.content.trim() },
          ...(fileId ? [{ id: fileId }] : []),
        ],
        ...(dto.senderId ? { uploaderId: dto.senderId } : {}),
      },
      select: { id: true },
    });
    if (!upload) {
      throw new BadRequestException('文件必须先由当前账号上传');
    }
  }

  private extractFileIdFromContent(content: string): string | null {
    const match = content.trim().match(/\/files\/([0-9a-f-]{36})/i);
    return match?.[1] ?? null;
  }

  async create(tenantId: string, dto: CreateMessageDto) {
    this.validateMessagePayload(dto);
    if (dto.senderType === 'USER' || dto.senderType === 'AGENT') {
      if (!dto.senderId) throw new BadRequestException('Missing sender');
      await this.sessionAuthorization.assertCanSend(
        tenantId,
        dto.sessionId,
        dto.senderType === 'USER' ? 'user' : 'agent',
        dto.senderId,
      );
    }
    await this.assertUploadedFile(tenantId, dto);

    const session = await this.sessionService.resolveSessionForMessage(
      tenantId,
      dto.sessionId,
      dto.senderType,
    );

    const isFile = (dto.type ?? 'TEXT') === 'FILE';
    const fileName = isFile
      ? decodeFileName(dto.fileName ?? readMetaString(dto.metadata, 'file_name', 'filename'))
      : undefined;

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        sessionId: session.id,
        senderType: dto.senderType,
        senderId: dto.senderId,
        type: dto.type ?? 'TEXT',
        content: dto.content,
        fileName: fileName ?? undefined,
        fileSize: isFile ? dto.fileSize : undefined,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    await this.prisma.session.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    await this.prisma.conversation.update({
      where: { id: session.conversationId },
      data: { updatedAt: new Date() },
    });

    const msgType = dto.type ?? 'TEXT';
    if (msgType === 'IMAGE' || msgType === 'VIDEO' || msgType === 'FILE') {
      await this.fileService.ensureFromMessage(tenantId, message);
    }

    return {
      message: toMessageDto({
        ...message,
        conversationId: session.conversationId,
      }),
      session,
    };
  }

  async listBySession(
    tenantId: string,
    sessionId: string,
    query: PaginationDto,
    role: AppRole,
    actorId: string,
  ) {
    await this.sessionAuthorization.assertActorAccess(
      tenantId,
      sessionId,
      role,
      actorId,
    );
    const { take, skip } = paginate(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { tenantId, sessionId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.message.count({ where: { tenantId, sessionId } }),
    ]);

    return {
      items: items.reverse().map((m) => toMessageDto(m)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async listByConversation(
    tenantId: string,
    conversationId: string,
    query: PaginationDto,
  ) {
    const sessions = await this.prisma.session.findMany({
      where: { tenantId, conversationId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        closedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) {
      return {
        items: [],
        sessions,
        total: 0,
        page: query.page,
        limit: query.limit,
      };
    }

    const { take, skip } = paginate(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { tenantId, sessionId: { in: sessionIds } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.message.count({
        where: { tenantId, sessionId: { in: sessionIds } },
      }),
    ]);

    return {
      items: items.reverse().map((m) => toMessageDto(m)),
      sessions,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async markRead(
    tenantId: string,
    messageId: string,
    role: AppRole,
    actorId: string,
  ) {
    await this.sessionAuthorization.assertMessageAccess(
      tenantId,
      messageId,
      role,
      actorId,
    );
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
    });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  }
}
