import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageSenderType, MessageType, Prisma } from '@prisma/client';
import { existsSync, statSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  resolveFileName,
  resolveFileSize,
} from '../../common/utils/file-message.util';

export interface CreateFileUploadDto {
  tenantId: string;
  uploaderType: MessageSenderType;
  uploaderId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  url: string;
}

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

function fileCategory(mimeType: string): 'image' | 'video' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

@Injectable()
export class FileService {
  private backfillPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  createRecord(dto: CreateFileUploadDto) {
    return this.prisma.fileUpload.create({ data: dto });
  }

  linkToMessage(tenantId: string, url: string, messageId: string) {
    return this.prisma.fileUpload.updateMany({
      where: { tenantId, url, messageId: null },
      data: { messageId },
    });
  }

  async ensureFromMessage(
    tenantId: string,
    message: {
      id: string;
      tenantId: string;
      type: MessageType;
      content: string;
      fileName?: string | null;
      fileSize?: number | null;
      metadata?: unknown;
      senderType: MessageSenderType;
      senderId: string | null;
      createdAt: Date;
    },
  ) {
    if (message.type !== 'IMAGE' && message.type !== 'VIDEO' && message.type !== 'FILE') {
      return;
    }

    const linked = await this.linkToMessage(tenantId, message.content, message.id);
    if (linked.count > 0) return;

    const existing = await this.prisma.fileUpload.findFirst({
      where: { tenantId, url: message.content },
    });
    if (existing) {
      if (!existing.messageId) {
        await this.prisma.fileUpload.update({
          where: { id: existing.id },
          data: { messageId: message.id },
        });
      }
      return;
    }

    await this.createFromMessage(message);
  }

  private async createFromMessage(message: {
    id: string;
    tenantId: string;
    type: MessageType;
    content: string;
    fileName?: string | null;
    fileSize?: number | null;
    metadata?: unknown;
    senderType: MessageSenderType;
    senderId: string | null;
    createdAt: Date;
  }) {
    const storagePath = this.extractStoragePath(message.content);
    if (!storagePath) return;

    const fileName = resolveFileName({
      fileName: message.fileName,
      metadata: message.metadata,
      content: message.content,
    });
    const fileSize =
      resolveFileSize({
        fileSize: message.fileSize,
        metadata: message.metadata,
      }) ?? this.getFileSizeFromDisk(storagePath);

    await this.prisma.fileUpload.create({
      data: {
        tenantId: message.tenantId,
        uploaderType: message.senderType,
        uploaderId: message.senderId ?? undefined,
        fileName,
        fileSize,
        mimeType: this.guessMimeType(fileName, message.type),
        storagePath,
        url: message.content,
        messageId: message.id,
        createdAt: message.createdAt,
      },
    });
  }

  private async backfillMissingFromMessages(tenantId?: string) {
    const where: Prisma.MessageWhereInput = {
      type: { in: ['IMAGE', 'VIDEO', 'FILE'] },
    };
    if (tenantId) where.tenantId = tenantId;

    const messages = await this.prisma.message.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        type: true,
        content: true,
        fileName: true,
        fileSize: true,
        metadata: true,
        senderType: true,
        senderId: true,
        createdAt: true,
      },
    });

    for (const message of messages) {
      const existing = await this.prisma.fileUpload.findFirst({
        where: { tenantId: message.tenantId, url: message.content },
      });
      if (existing) {
        if (!existing.messageId) {
          await this.prisma.fileUpload.update({
            where: { id: existing.id },
            data: { messageId: message.id },
          });
        }
        continue;
      }
      await this.createFromMessage(message);
    }
  }

  private runBackfillOnce() {
    if (!this.backfillPromise) {
      this.backfillPromise = this.backfillMissingFromMessages();
    }
    return this.backfillPromise;
  }

  private extractStoragePath(url: string): string | null {
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  }

  private getFileSizeFromDisk(storagePath: string): number {
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const fullPath = join(process.cwd(), uploadDir, storagePath);
    if (!existsSync(fullPath)) return 0;
    try {
      return statSync(fullPath).size;
    } catch {
      return 0;
    }
  }

  private guessMimeType(fileName: string, type: MessageType): string {
    const ext = extname(fileName).toLowerCase();
    const byExt: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
    };
    if (byExt[ext]) return byExt[ext];
    if (type === 'IMAGE') return 'image/*';
    if (type === 'VIDEO') return 'video/*';
    return 'application/octet-stream';
  }

  async list(
    tenantId: string | undefined,
    query: {
      page?: number;
      limit?: number;
      keyword?: string;
      category?: 'image' | 'video' | 'file';
      tenantCode?: string;
      startTime?: string;
      endTime?: string;
      uploader?: string;
      uploaderAgentId?: string;
    },
  ) {
    await this.runBackfillOnce();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.FileUploadWhereInput = {};

    let resolvedTenantId = tenantId;
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (query.tenantCode) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { tenantCode: query.tenantCode },
        select: { id: true },
      });
      if (tenant) {
        resolvedTenantId = tenant.id;
        where.tenantId = tenant.id;
      }
    }

    if (query.keyword) {
      where.fileName = { contains: query.keyword, mode: 'insensitive' };
    }

    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }

    if (query.uploaderAgentId) {
      where.uploaderType = MessageSenderType.AGENT;
      where.uploaderId = query.uploaderAgentId;
    } else if (query.uploader?.trim()) {
      const uploaderWhere = await this.buildUploaderFilter(
        resolvedTenantId,
        query.uploader.trim(),
      );
      if (!uploaderWhere) {
        return { items: [], total: 0, page, limit };
      }
      const existingAnd = where.AND
        ? Array.isArray(where.AND) ? where.AND : [where.AND]
        : [];
      where.AND = [...existingAnd, uploaderWhere];
    }

    if (query.category === 'image') {
      where.mimeType = { startsWith: 'image/' };
    } else if (query.category === 'video') {
      where.mimeType = { startsWith: 'video/' };
    } else if (query.category === 'file') {
      where.NOT = [
        { mimeType: { startsWith: 'image/' } },
        { mimeType: { startsWith: 'video/' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.fileUpload.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: tenantId
          ? undefined
          : { tenant: { select: { tenantCode: true, name: true } } },
      }),
      this.prisma.fileUpload.count({ where }),
    ]);

    const items = await this.enrichWithUploaderNames(resolvedTenantId, rows);

    return {
      items: items.map((f) => ({ ...f, category: fileCategory(f.mimeType) })),
      total,
      page,
      limit,
    };
  }

  private async buildUploaderFilter(
    tenantId: string | undefined,
    uploader: string,
  ): Promise<Prisma.FileUploadWhereInput | null> {
    const tenantFilter = tenantId ? { tenantId } : {};
    const userOr: Prisma.UserWhereInput[] = [
      { nickname: { contains: uploader, mode: 'insensitive' } },
    ];
    const visitorMatch = uploader.match(/(?:访客\s*#?\s*)?(\d+)/);
    if (visitorMatch) {
      const num = parseInt(visitorMatch[1], 10);
      if (!Number.isNaN(num)) userOr.push({ visitorNo: num });
    }

    const [agents, users] = await Promise.all([
      this.prisma.agent.findMany({
        where: { ...tenantFilter, name: { contains: uploader, mode: 'insensitive' } },
        select: { id: true },
      }),
      this.prisma.user.findMany({
        where: { ...tenantFilter, OR: userOr },
        select: { id: true },
      }),
    ]);

    const orConditions: Prisma.FileUploadWhereInput[] = [];
    if (agents.length) {
      orConditions.push({
        uploaderType: MessageSenderType.AGENT,
        uploaderId: { in: agents.map((a) => a.id) },
      });
    }
    if (users.length) {
      orConditions.push({
        uploaderType: MessageSenderType.USER,
        uploaderId: { in: users.map((u) => u.id) },
      });
    }
    if (!orConditions.length) return null;
    return { OR: orConditions };
  }

  private async enrichWithUploaderNames<
    T extends {
      uploaderType: MessageSenderType;
      uploaderId: string | null;
      tenantId: string;
    },
  >(tenantId: string | undefined, items: T[]) {
    if (!items.length) return items;

    const agentIds = new Set<string>();
    const userIds = new Set<string>();
    for (const f of items) {
      if (f.uploaderType === MessageSenderType.AGENT && f.uploaderId) {
        agentIds.add(f.uploaderId);
      }
      if (f.uploaderType === MessageSenderType.USER && f.uploaderId) {
        userIds.add(f.uploaderId);
      }
    }

    const agentWhere: Prisma.AgentWhereInput = { id: { in: [...agentIds] } };
    const userWhere: Prisma.UserWhereInput = { id: { in: [...userIds] } };
    if (tenantId) {
      agentWhere.tenantId = tenantId;
      userWhere.tenantId = tenantId;
    } else {
      const tenantIds = [...new Set(items.map((f) => f.tenantId))];
      agentWhere.tenantId = { in: tenantIds };
      userWhere.tenantId = { in: tenantIds };
    }

    const [agents, users] = await Promise.all([
      agentIds.size
        ? this.prisma.agent.findMany({
            where: agentWhere,
            select: { id: true, name: true },
          })
        : [],
      userIds.size
        ? this.prisma.user.findMany({
            where: userWhere,
            select: { id: true, nickname: true, visitorNo: true },
          })
        : [],
    ]);

    const agentMap = new Map(agents.map((a) => [a.id, a.name]));
    const userMap = new Map(
      users.map((u) => [
        u.id,
        u.nickname ?? (u.visitorNo ? `访客#${u.visitorNo}` : '访客'),
      ]),
    );

    return items.map((f) => ({
      ...f,
      uploaderName: this.resolveUploaderName(f, agentMap, userMap),
    }));
  }

  private resolveUploaderName(
    file: { uploaderType: MessageSenderType; uploaderId: string | null },
    agentMap: Map<string, string>,
    userMap: Map<string, string>,
  ) {
    if (file.uploaderType === MessageSenderType.SYSTEM) return '系统';
    if (file.uploaderType === MessageSenderType.AGENT) {
      return (file.uploaderId && agentMap.get(file.uploaderId)) || '客服';
    }
    if (file.uploaderType === MessageSenderType.USER) {
      return (file.uploaderId && userMap.get(file.uploaderId)) || '访客';
    }
    return file.uploaderType;
  }

  async getStats(tenantId?: string) {
    await this.runBackfillOnce();

    const where: Prisma.FileUploadWhereInput = tenantId ? { tenantId } : {};
    const today = startOfToday();
    const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 86400000));

    const [totalCount, todayCount, allFiles] = await Promise.all([
      this.prisma.fileUpload.count({ where }),
      this.prisma.fileUpload.count({ where: { ...where, createdAt: { gte: today } } }),
      this.prisma.fileUpload.findMany({
        where,
        select: { fileSize: true, mimeType: true, createdAt: true },
      }),
    ]);

    let totalSize = 0;
    let imageCount = 0;
    let videoCount = 0;
    let fileCount = 0;
    const dailyMap = new Map<string, number>();

    for (const f of allFiles) {
      totalSize += f.fileSize;
      const cat = fileCategory(f.mimeType);
      if (cat === 'image') imageCount++;
      else if (cat === 'video') videoCount++;
      else fileCount++;

      const day = f.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }

    const uploadTrend7d = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      return { date: key.slice(5), count: dailyMap.get(key) ?? 0 };
    });

    return {
      totalCount,
      todayCount,
      totalSize,
      imageCount,
      videoCount,
      fileCount,
      uploadTrend7d,
    };
  }

  async delete(tenantId: string | undefined, id: string) {
    const where: Prisma.FileUploadWhereInput = { id };
    if (tenantId) where.tenantId = tenantId;

    const record = await this.prisma.fileUpload.findFirst({ where });
    if (!record) throw new NotFoundException('文件记录不存在');

    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const fullPath = join(process.cwd(), uploadDir, record.storagePath);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        /* ignore missing file on disk */
      }
    }

    await this.prisma.fileUpload.delete({ where: { id: record.id } });
    return { success: true };
  }
}
