import { Module } from '@nestjs/common';
import { RemarkService } from './remark.service';
import { RemarkController } from './remark.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [RemarkController],
  providers: [RemarkService],
  exports: [RemarkService],
})
export class RemarkModule {}
