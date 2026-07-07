import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SessionService } from './session.service';
import { ChatGateway } from '../websocket/chat.gateway';

@Injectable()
export class SessionTimeoutScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly sessionService: SessionService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.run(), 60_000);
    this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    const results = await this.sessionService.closeTimedOutSessions();
    for (const { tenantId, session } of results) {
      gateway?.notifySessionClose(tenantId, session, 'SYSTEM');
    }
  }
}
