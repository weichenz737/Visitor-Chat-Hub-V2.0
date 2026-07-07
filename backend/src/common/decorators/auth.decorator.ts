import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AppRole = 'user' | 'agent' | 'tenant_admin' | 'platform_admin';
export type StaffRole = 'TENANT_ADMIN' | 'SUPERVISOR' | 'AGENT';

export interface AuthPayload {
  sub: string;
  tenantId?: string;
  tenantCode?: string;
  role: AppRole;
  staffRole?: StaffRole;
  email?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId ?? request.headers['x-tenant-id'];
  },
);
