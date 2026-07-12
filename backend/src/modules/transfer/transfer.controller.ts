import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TransferService } from './transfer.service';
import { TenantAuthorizationService } from '../../common/services/tenant-authorization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { ChatGateway } from '../websocket/chat.gateway';

@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('agent')
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly moduleRef: ModuleRef,
    private readonly tenantAuth: TenantAuthorizationService,
  ) {}

  @Post()
  async transfer(
    @CurrentUser() user: AuthPayload,
    @Body() body: { sessionId: string; toAgentId: string; reason?: string },
  ) {
    await this.tenantAuth.assertAllowAgentTransfer(user.tenantId!);
    const result = await this.transferService.transfer(
      user.tenantId!,
      body.sessionId,
      user.sub,
      body.toAgentId,
      body.reason,
    );
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    gateway?.notifyTransferSession(user.tenantId!, result.session);
    return result;
  }

  @Get('session/:sessionId')
  listBySession(
    @CurrentUser() user: AuthPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.transferService.listBySession(
      user.tenantId!,
      sessionId,
      user.sub,
    );
  }
}
