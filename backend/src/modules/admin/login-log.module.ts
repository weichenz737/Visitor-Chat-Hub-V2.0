import { Module } from '@nestjs/common';
import { LoginLogService } from './login-log.service';

@Module({
  providers: [LoginLogService],
  exports: [LoginLogService],
})
export class LoginLogModule {}
