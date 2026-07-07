import { Module } from '@nestjs/common';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantAdminService } from './tenant-admin.service';
import { QuickReplyModule } from '../quick-reply/quick-reply.module';
import { StaffRolesGuard } from '../../common/guards/staff-roles.guard';
import { ChatAdminModule } from '../chat-admin/chat-admin.module';
import { FileModule } from '../file/file.module';
import { TransferModule } from '../transfer/transfer.module';

@Module({
  imports: [QuickReplyModule, ChatAdminModule, FileModule, TransferModule],
  controllers: [TenantAdminController],
  providers: [TenantAdminService, StaffRolesGuard],
})
export class TenantAdminModule {}
