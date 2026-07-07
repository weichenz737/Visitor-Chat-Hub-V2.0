import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

const tenantPublicSelect = {
  tenantCode: true,
  name: true,
  slug: true,
  adminEmail: true,
  status: true,
  createdAt: true,
  _count: { select: { agents: true, users: true, sessions: true } },
} as const;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: tenantPublicSelect,
    });
  }

  async findByTenantCode(tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantCode },
      select: tenantPublicSelect,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findByApiKey(apiKey: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { apiKey } });
    if (!tenant) throw new NotFoundException('Invalid API key');
    if (tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Tenant is not available');
    }
    return tenant;
  }

  async create(data: {
    name: string;
    tenantCode: string;
    slug: string;
    adminEmail: string;
    adminPassword?: string;
    contactName?: string;
    contactPhone?: string;
    remark?: string;
  }) {
    const apiKey = `cs_${randomBytes(24).toString('hex')}`;
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        tenantCode: data.tenantCode,
        slug: data.slug,
        adminEmail: data.adminEmail,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        remark: data.remark,
        apiKey,
      },
      select: tenantPublicSelect,
    });
  }

  async updateStatus(tenantCode: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') {
    await this.findByTenantCode(tenantCode);
    return this.prisma.tenant.update({
      where: { tenantCode },
      data: { status },
      select: tenantPublicSelect,
    });
  }
}
