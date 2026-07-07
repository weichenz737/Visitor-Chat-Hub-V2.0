import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from './auth.decorator';

export const STAFF_ROLES_KEY = 'staffRoles';
export const StaffRoles = (...roles: StaffRole[]) =>
  SetMetadata(STAFF_ROLES_KEY, roles);
