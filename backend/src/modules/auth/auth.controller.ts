import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginLogService } from '../admin/login-log.service';
import { Public } from '../../common/decorators/roles.decorator';

function loginCtx(req: Request) {
  return {
    ip: req.ip || req.headers['x-forwarded-for']?.toString(),
    userAgent: req.headers['user-agent'],
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  @Public()
  @Post('user/init')
  initUser(
    @Body()
    body: {
      apiKey: string;
      deviceId?: string;
      pageUrl?: string;
      referer?: string;
      source?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    },
  ) {
    const { apiKey, deviceId, ...source } = body;
    return this.authService.initUser(apiKey, deviceId, source);
  }

  @Public()
  @Post('platform/login')
  async loginPlatform(
    @Req() req: Request,
    @Body() body: { email: string; password: string },
  ) {
    const ctx = loginCtx(req);
    try {
      const result = await this.authService.loginPlatformAdmin(body.email, body.password);
      await this.loginLogService.record(
        { account: body.email, role: 'PLATFORM_ADMIN', success: true },
        ctx,
      );
      return result;
    } catch (e) {
      await this.loginLogService.record(
        {
          account: body.email,
          role: 'PLATFORM_ADMIN',
          success: false,
          failReason: e instanceof Error ? e.message : '登录失败',
        },
        ctx,
      );
      throw e;
    }
  }

  /** @deprecated 使用 /auth/platform/login */
  @Public()
  @Post('admin/login')
  loginAdminLegacy(@Req() req: Request, @Body() body: { email: string; password: string }) {
    return this.loginPlatform(req, body);
  }

  @Public()
  @Post('tenant/login')
  async loginTenant(
    @Req() req: Request,
    @Body() body: { email: string; password: string; tenantCode: string },
  ) {
    const ctx = loginCtx(req);
    try {
      const result = await this.authService.loginTenantAdmin(
        body.email,
        body.password,
        body.tenantCode,
      );
      await this.loginLogService.record(
        {
          account: body.email,
          role: result.user.staffRole,
          tenantCode: result.user.tenantCode,
          tenantName: result.user.tenantName,
          success: true,
        },
        ctx,
      );
      return result;
    } catch (e) {
      await this.loginLogService.record(
        {
          account: body.email,
          role: 'TENANT_ADMIN',
          tenantCode: body.tenantCode,
          success: false,
          failReason: e instanceof Error ? e.message : '登录失败',
        },
        ctx,
      );
      throw e;
    }
  }

  @Public()
  @Post('agent/login')
  async loginAgent(
    @Req() req: Request,
    @Body() body: { email: string; password: string; tenantCode: string },
  ) {
    const ctx = loginCtx(req);
    try {
      const result = await this.authService.loginAgent(
        body.email,
        body.password,
        body.tenantCode,
      );
      await this.loginLogService.record(
        {
          account: body.email,
          role: 'AGENT',
          tenantCode: result.agent.tenantCode,
          tenantName: result.agent.tenantName,
          success: true,
        },
        ctx,
      );
      return result;
    } catch (e) {
      await this.loginLogService.record(
        {
          account: body.email,
          role: 'AGENT',
          tenantCode: body.tenantCode,
          success: false,
          failReason: e instanceof Error ? e.message : '登录失败',
        },
        ctx,
      );
      throw e;
    }
  }
}
