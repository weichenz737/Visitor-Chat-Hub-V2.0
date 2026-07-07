import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [SessionModule, MessageModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
