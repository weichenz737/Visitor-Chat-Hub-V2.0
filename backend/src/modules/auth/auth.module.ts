import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantModule } from '../tenant/tenant.module';
import { LoginLogModule } from '../admin/login-log.module';

@Global()
@Module({
  imports: [
    TenantModule,
    LoginLogModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        if (
          secret === 'default-secret' ||
          secret === 'change-me-in-production' ||
          secret === 'replace-with-at-least-32-random-characters'
        ) {
          throw new Error('JWT_SECRET must not use a known default value');
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
