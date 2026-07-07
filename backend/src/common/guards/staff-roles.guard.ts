import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLES_KEY } from '../decorators/staff-roles.decorator';
import type { AuthPayload, StaffRole } from '../decorators/auth.decorator';

@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffRole[]>(
      STAFF_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest() as { user?: AuthPayload };
    if (!user?.staffRole || !required.includes(user.staffRole)) {
      throw new ForbiddenException('无权执行此操作');
    }
    return true;
  }
}
