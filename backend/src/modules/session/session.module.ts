import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionTimeoutScheduler } from './session-timeout.scheduler';
import { SessionController } from './session.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AgentModule],
  controllers: [SessionController],
  providers: [SessionService, SessionTimeoutScheduler],
  exports: [SessionService],
})
export class SessionModule {}
