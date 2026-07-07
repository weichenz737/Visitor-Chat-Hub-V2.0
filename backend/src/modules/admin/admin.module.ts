import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OperationLogService } from './operation-log.service';
import { QuickReplyModule } from '../quick-reply/quick-reply.module';
import { LoginLogModule } from './login-log.module';
import { ChatAdminModule } from '../chat-admin/chat-admin.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [QuickReplyModule, LoginLogModule, ChatAdminModule, FileModule],
  controllers: [AdminController],
  providers: [AdminService, OperationLogService],
  exports: [AdminService, OperationLogService],
})
export class AdminModule {}
