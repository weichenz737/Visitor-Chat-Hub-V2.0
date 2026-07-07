import { Module } from '@nestjs/common';
import { QuickReplyService } from './quick-reply.service';
import { QuickReplyController } from './quick-reply.controller';

@Module({
  controllers: [QuickReplyController],
  providers: [QuickReplyService],
  exports: [QuickReplyService],
})
export class QuickReplyModule {}
