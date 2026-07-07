import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { SessionModule } from '../session/session.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [SessionModule, FileModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
