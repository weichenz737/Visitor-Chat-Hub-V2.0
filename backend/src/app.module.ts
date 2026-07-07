import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AgentModule } from './modules/agent/agent.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { SessionModule } from './modules/session/session.module';
import { MessageModule } from './modules/message/message.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { RemarkModule } from './modules/remark/remark.module';
import { QuickReplyModule } from './modules/quick-reply/quick-reply.module';
import { UploadModule } from './modules/upload/upload.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { AdminModule } from './modules/admin/admin.module';
import { TenantAdminModule } from './modules/tenant-admin/tenant-admin.module';
import { TenantAuthorizationModule } from './common/services/tenant-authorization.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    TenantAuthorizationModule,
    TenantModule,
    AuthModule,
    UserModule,
    AgentModule,
    SessionModule,
    ConversationModule,
    MessageModule,
    TransferModule,
    RemarkModule,
    QuickReplyModule,
    UploadModule,
    WebSocketModule,
    AdminModule,
    TenantAdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
