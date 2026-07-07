import { Controller, Delete, Get, Param, Patch, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConversationService } from './conversation.service';
import { MessageService } from '../message/message.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('me')
  @Roles('user')
  getMine(
    @CurrentUser() user: AuthPayload,
    @Query('agentCode') agentCode?: string,
  ) {
    return this.conversationService.getMine(user.tenantId!, user.sub, agentCode);
  }

  @Get('agent')
  @Roles('agent')
  listForAgent(
    @CurrentUser() user: AuthPayload,
    @Query() query: PaginationDto,
    @Query('archived') archived?: string,
  ) {
    return this.conversationService.listForAgent(user.tenantId!, user.sub, {
      ...query,
      archived,
    });
  }

  @Patch(':id/archive')
  @Roles('agent')
  archive(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.conversationService.archive(user.tenantId!, id, user.sub);
  }

  @Patch(':id/unarchive')
  @Roles('agent')
  unarchive(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.conversationService.unarchive(user.tenantId!, id, user.sub);
  }

  @Delete(':id')
  @Roles('agent')
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    const result = await this.conversationService.removeConversation(
      user.tenantId!,
      id,
      user.sub,
    );
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    if (result.session) {
      gateway?.notifySessionClose(user.tenantId!, result.session, 'AGENT');
    }
    return result;
  }

  @Patch(':id/read')
  @Roles('agent')
  async markRead(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
  ) {
    return this.conversationService.markConversationRead(
      user.tenantId!,
      id,
      user.sub,
    );
  }

  @Get(':id/messages')
  @Roles('user', 'agent')
  async listMessages(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Query() query: PaginationDto,
  ) {
    if (user.role === 'agent') {
      await this.conversationService.assertAgentAccess(
        user.tenantId!,
        id,
        user.sub,
      );
    } else {
      const conv = await this.conversationService.findById(user.tenantId!, id);
      if (conv.userId !== user.sub) {
        throw new ForbiddenException('无权查看此会话');
      }
    }
    return this.messageService.listByConversation(user.tenantId!, id, query);
  }

  @Get(':id')
  @Roles('user', 'agent')
  async findOne(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
  ) {
    if (user.role === 'agent') {
      await this.conversationService.assertAgentAccess(
        user.tenantId!,
        id,
        user.sub,
      );
    } else {
      const conv = await this.conversationService.findById(user.tenantId!, id);
      if (conv.userId !== user.sub) {
        throw new ForbiddenException('无权查看此会话');
      }
    }
    const conversation = await this.conversationService.findById(
      user.tenantId!,
      id,
    );
    const currentSession = await this.conversationService.getOpenSession(id);
    return { ...conversation, currentSession };
  }
}
