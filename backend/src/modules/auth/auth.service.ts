import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { AuthPayload, StaffRole } from '../../common/decorators/auth.decorator';

const TENANT_ADMIN_ROLES: StaffRole[] = ['TENANT_ADMIN', 'SUPERVISOR'];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
  ) {}

  async loginPlatformAdmin(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email },
    });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const payload: AuthPayload = {
      sub: admin.id,
      role: 'platform_admin',
      email: admin.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      admin: { id: admin.id, name: admin.name, email: admin.email, role: 'PLATFORM_ADMIN' },
    };
  }

  async loginTenantAdmin(account: string, password: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantCode },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('企业不可用');
    }

    const staff = await this.prisma.agent.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: account } },
    });
    if (!staff || !(await bcrypt.compare(password, staff.password))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (!TENANT_ADMIN_ROLES.includes(staff.role as StaffRole)) {
      throw new UnauthorizedException('请使用客服工作台登录');
    }
    if (staff.accountStatus === 'SUSPENDED') {
      throw new UnauthorizedException('账号已冻结');
    }

    const payload: AuthPayload = {
      sub: staff.id,
      tenantId: tenant.id,
      tenantCode: tenant.tenantCode,
      role: 'tenant_admin',
      staffRole: staff.role as StaffRole,
      email: staff.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        staffRole: staff.role,
        tenantCode: tenant.tenantCode,
        tenantName: tenant.name,
      },
    };
  }

  async loginAgent(account: string, password: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantCode },
    });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('企业不可用');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: account } },
    });
    if (!agent || !(await bcrypt.compare(password, agent.password))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (agent.role !== 'AGENT') {
      throw new UnauthorizedException('请使用企业后台登录');
    }
    if (agent.accountStatus === 'SUSPENDED') {
      throw new UnauthorizedException('账号已冻结');
    }

    const payload: AuthPayload = {
      sub: agent.id,
      tenantId: agent.tenantId,
      tenantCode: tenant.tenantCode,
      role: 'agent',
      staffRole: 'AGENT',
      email: agent.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        staffRole: agent.role,
        tenantCode: tenant.tenantCode,
        tenantName: tenant.name,
        agentCode: agent.agentCode,
        status: agent.status,
        phone: agent.phone,
        avatar: agent.avatar,
      },
    };
  }

  async initUser(
    apiKey: string,
    deviceId?: string,
    source?: {
      pageUrl?: string;
      referer?: string;
      source?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    },
  ) {
    const tenant = await this.tenantService.findByApiKey(apiKey);
    if (tenant.status !== 'ACTIVE') {
      throw new BadRequestException('租户已冻结或停用，无法接入');
    }

    const now = new Date();
    const resolvedDeviceId = deviceId ?? `anon_${Date.now()}`;

    let user = await this.prisma.user.findUnique({
      where: { tenantId_deviceId: { tenantId: tenant.id, deviceId: resolvedDeviceId } },
    });

    if (!user) {
      const max = await this.prisma.user.aggregate({
        where: { tenantId: tenant.id },
        _max: { visitorNo: true },
      });
      const visitorNo = (max._max.visitorNo ?? 0) + 1;
      const visitorName = `访客${String(visitorNo).padStart(6, '0')}`;

      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          deviceId: resolvedDeviceId,
          visitorNo,
          nickname: visitorName,
          originalName: visitorName,
          firstSeenAt: now,
          lastSeenAt: now,
          metadata: source ?? {},
        },
      });
    } else {
      const mergedMeta = {
        ...(typeof user.metadata === 'object' && user.metadata ? user.metadata : {}),
        ...(source ?? {}),
      };
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastSeenAt: now,
          metadata: mergedMeta,
          nickname: user.nickname || user.originalName,
          originalName: user.originalName ?? user.nickname,
        },
      });
    }

    const payload: AuthPayload = {
      sub: user.id,
      tenantId: tenant.id,
      role: 'user',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nickname: user.nickname,
        originalName: user.originalName,
        visitorNo: user.visitorNo,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    };
  }
}
