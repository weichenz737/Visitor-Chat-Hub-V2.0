import { Global, Module } from '@nestjs/common';
import { TenantAuthorizationService } from './tenant-authorization.service';

@Global()
@Module({
  providers: [TenantAuthorizationService],
  exports: [TenantAuthorizationService],
})
export class TenantAuthorizationModule {}
