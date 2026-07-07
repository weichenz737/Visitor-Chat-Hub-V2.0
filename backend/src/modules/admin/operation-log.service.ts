import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogContext {
  adminId?: string;
  adminEmail: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ctx: LogContext,
    action: string,
    target?: string,
    detail?: string,
  ) {
    return this.prisma.operationLog.create({
      data: {
        adminId: ctx.adminId,
        adminEmail: ctx.adminEmail,
        action,
        target,
        detail,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    keyword?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = query.keyword
      ? {
          OR: [
            { action: { contains: query.keyword, mode: 'insensitive' as const } },
            { adminEmail: { contains: query.keyword, mode: 'insensitive' as const } },
            { target: { contains: query.keyword, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
