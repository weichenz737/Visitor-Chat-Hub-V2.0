import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SessionService } from './session.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SessionAuthorizationService } from './session-authorization.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionAuthorization: SessionAuthorizationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post()
  @Roles('user')
  create(
    @CurrentUser() user: AuthPayload,
    @Body() body: { agentCode?: string } = {},
  ) {
    return this.sessionService.create(user.tenantId!, user.sub, {
      agentCode: body.agentCode,
    });
  }

  @Get()
  @Roles('user')
  listMine(@CurrentUser() user: AuthPayload) {
    return this.sessionService.listForUser(user.tenantId!, user.sub);
  }

  @Get('agent')
  @Roles('agent')
  listForAgent(
    @CurrentUser() user: AuthPayload,
    @Query() query: PaginationDto,
  ) {
    return this.sessionService.listForAgent(user.tenantId!, user.sub, query);
  }

  @Get(':id')
  @Roles('user', 'agent', 'tenant_admin')
  async findOne(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    if (user.role === 'user' || user.role === 'agent') {
      await this.sessionAuthorization.assertActorAccess(
        user.tenantId!,
        id,
        user.role,
        user.sub,
      );
    }
    const session = await this.sessionService.findById(user.tenantId!, id);
    return session;
  }

  @Patch(':id/assign')
  @Roles('agent')
  async assign(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { agentId?: string },
  ) {
    if (body.agentId && body.agentId !== user.sub) {
      throw new ForbiddenException('客服只能将等待会话分配给自己');
    }
    const session = await this.sessionService.claimForAgent(
      user.tenantId!,
      id,
      user.sub,
    );
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    gateway?.notifySessionAssigned(user.tenantId!, session);
    return session;
  }

  @Patch(':id/close')
  @Roles('agent', 'user')
  async close(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    const closedBy = user.role === 'agent' ? 'AGENT' : 'USER';
    const result = await this.sessionService.close(user.tenantId!, id, {
      closedBy,
      closedReason: 'MANUAL',
      actorId: user.sub,
    });
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    gateway?.notifySessionClose(
      user.tenantId!,
      result.session,
      closedBy,
    );
    return result;
  }

  @Patch(':id/remove')
  @Roles('agent')
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    const result = await this.sessionService.remove(user.tenantId!, id, user.sub);
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    gateway?.notifySessionClose(
      user.tenantId!,
      result.session,
      'AGENT',
    );
    return result;
  }
}
