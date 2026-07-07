import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { SessionModule } from '../session/session.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [SessionModule, AgentModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
