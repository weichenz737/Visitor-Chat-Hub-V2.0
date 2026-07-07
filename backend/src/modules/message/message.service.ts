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
    private readonly fileService: FileService,
  ) {}

  async create(tenantId: string, dto: CreateMessageDto) {
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

    return { message: toMessageDto(message), session };
  }

  async listBySession(
    tenantId: string,
    sessionId: string,
    query: PaginationDto,
  ) {
    await this.sessionService.findById(tenantId, sessionId);
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
        orderBy: { createdAt: 'asc' },
        take,
        skip,
      }),
      this.prisma.message.count({
        where: { tenantId, sessionId: { in: sessionIds } },
      }),
    ]);

    return {
      items: items.map((m) => toMessageDto(m)),
      sessions,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async markRead(tenantId: string, messageId: string) {
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
