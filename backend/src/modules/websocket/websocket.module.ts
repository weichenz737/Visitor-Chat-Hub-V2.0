import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessageModule } from '../message/message.module';
import { SessionModule } from '../session/session.module';
import { ConversationModule } from '../conversation/conversation.module';
import { TransferModule } from '../transfer/transfer.module';
import { AgentModule } from '../agent/agent.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MessageModule,
    SessionModule,
    ConversationModule,
    TransferModule,
    AgentModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class WebSocketModule {}
