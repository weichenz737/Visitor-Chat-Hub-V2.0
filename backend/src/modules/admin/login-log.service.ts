import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type LoginLogContext = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class LoginLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    data: {
      account: string;
      role: string;
      tenantCode?: string;
      tenantName?: string;
      success: boolean;
      failReason?: string;
    },
    ctx: LoginLogContext,
  ) {
    return this.prisma.loginLog.create({
      data: {
        account: data.account,
        role: data.role,
        tenantCode: data.tenantCode,
        tenantName: data.tenantName,
        success: data.success,
        failReason: data.failReason,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    keyword?: string;
    success?: boolean;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: {
      OR?: Array<Record<string, unknown>>;
      success?: boolean;
    } = {};
    if (query.keyword) {
      where.OR = [
        { account: { contains: query.keyword, mode: 'insensitive' } },
        { tenantCode: { contains: query.keyword, mode: 'insensitive' } },
        { tenantName: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.success !== undefined) where.success = query.success;

    const [items, total] = await Promise.all([
      this.prisma.loginLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loginLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
