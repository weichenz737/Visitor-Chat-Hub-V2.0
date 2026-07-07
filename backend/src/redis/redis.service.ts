import { Global, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.get<string>('REDIS_URL')!);
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  tenantOnlineUsersKey(tenantId: string) {
    return `tenant:${tenantId}:online_users`;
  }

  sessionCacheKey(sessionId: string) {
    return `session:${sessionId}:cache`;
  }

  agentStatusKey(agentId: string) {
    return `agent:${agentId}:status`;
  }

  agentConnectionsKey(agentId: string) {
    return `agent:${agentId}:ws_connections`;
  }

  wsChannel(tenantId: string, sessionId: string) {
    return `tenant:${tenantId}:session:${sessionId}`;
  }
}
