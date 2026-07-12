import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionTimeoutScheduler } from './session-timeout.scheduler';
import { SessionController } from './session.controller';
import { AgentModule } from '../agent/agent.module';
import { SessionAuthorizationService } from './session-authorization.service';

@Module({
  imports: [AgentModule],
  controllers: [SessionController],
  providers: [
    SessionService,
    SessionAuthorizationService,
    SessionTimeoutScheduler,
  ],
  exports: [SessionService, SessionAuthorizationService],
})
export class SessionModule {}
