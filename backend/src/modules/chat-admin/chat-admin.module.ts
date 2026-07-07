import { Module } from '@nestjs/common';
import { ChatAdminService } from './chat-admin.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [ChatAdminService],
  exports: [ChatAdminService],
})
export class ChatAdminModule {}
