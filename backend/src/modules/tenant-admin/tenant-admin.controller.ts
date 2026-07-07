import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TenantAdminService } from './tenant-admin.service';
import { ChatAdminService } from '../chat-admin/chat-admin.service';
import { FileService } from '../file/file.service';
import { TransferService } from '../transfer/transfer.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StaffRolesGuard } from '../../common/guards/staff-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StaffRoles } from '../../common/decorators/staff-roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

@Controller('tenant-admin')
@UseGuards(JwtAuthGuard, RolesGuard, StaffRolesGuard)
@Roles('tenant_admin')
export class TenantAdminController {
  constructor(
    private readonly tenantAdminService: TenantAdminService,
    private readonly chatAdminService: ChatAdminService,
    private readonly fileService: FileService,
    private readonly transferService: TransferService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthPayload) {
    return this.tenantAdminService.getDashboard(user.tenantId!);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthPayload) {
    return this.tenantAdminService.getProfile(user.tenantId!);
  }

  @Patch('profile')
  @StaffRoles('TENANT_ADMIN')
  updateProfile(
    @CurrentUser() user: AuthPayload,
    @Body()
    body: {
      name?: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
      domain?: string;
    },
  ) {
    return this.tenantAdminService.updateProfile(user.tenantId!, body, user);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthPayload) {
    return this.tenantAdminService.getSettings(user.tenantId!);
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthPayload,
    @Body() body: Record<string, string>,
  ) {
    return this.tenantAdminService.updateSettings(user.tenantId!, body);
  }

  @Post('regenerate-api-key')
  @StaffRoles('TENANT_ADMIN')
  regenerateApiKey(@CurrentUser() user: AuthPayload) {
    return this.tenantAdminService.regenerateApiKey(user.tenantId!, user);
  }

  @Get('agents')
  listAgents(
    @CurrentUser() user: AuthPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('role') role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN',
  ) {
    return this.tenantAdminService.listAgents(user.tenantId!, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      role,
    });
  }

  @Post('agents')
  createAgent(
    @CurrentUser() user: AuthPayload,
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR';
      remark?: string;
    },
  ) {
    return this.tenantAdminService.createAgent(user.tenantId!, body, user);
  }

  @Patch('agents/:id')
  updateAgent(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
  ) {
    return this.tenantAdminService.updateAgent(user.tenantId!, id, body, user);
  }

  @Post('agents/:id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.tenantAdminService.resetAgentPassword(
      user.tenantId!,
      id,
      body.password,
    );
  }

  @Delete('agents/:id')
  deleteAgent(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.tenantAdminService.deleteAgent(user.tenantId!, id, user);
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() user: AuthPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: 'ACTIVE' | 'CLOSED' | 'WAITING' | 'current',
  ) {
    return this.tenantAdminService.listSessions(user.tenantId!, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      status,
    });
  }

  @Get('sessions/:id/messages')
  sessionMessages(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.tenantAdminService.getSessionMessages(user.tenantId!, id);
  }

  @Get('chat-users')
  listChatUsers(
    @CurrentUser() user: AuthPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('sessionStatus') sessionStatus?: string,
  ) {
    return this.chatAdminService.listChatUsers(user.tenantId!, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      startTime,
      endTime,
      sessionStatus,
    });
  }

  @Get('chat-users/:userId/messages')
  getChatUserMessages(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('senderType') senderType?: 'USER' | 'AGENT' | 'SYSTEM',
    @Query('content') content?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.chatAdminService.getChatUserMessages(
      user.tenantId!,
      userId,
      page ? +page : 1,
      limit ? +limit : 50,
      { senderType, content, startTime, endTime },
    );
  }

  @Delete('messages/:id')
  deleteMessage(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.chatAdminService.deleteMessage(user.tenantId!, id);
  }

  @Delete('chat-users/:userId/messages')
  deleteChatUserMessages(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
  ) {
    return this.chatAdminService.deleteChatUserMessages(user.tenantId!, userId);
  }

  @Post('sessions/:id/transfer')
  async transferSession(
    @CurrentUser() user: AuthPayload,
    @Param('id') sessionId: string,
    @Body() body: { toAgentId: string; reason?: string },
  ) {
    const result = await this.transferService.adminTransfer(
      user.tenantId!,
      sessionId,
      body.toAgentId,
      body.reason,
    );
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    gateway?.notifyTransferSession(user.tenantId!, result.session);
    return result;
  }

  @Get('files')
  listFiles(
    @CurrentUser() user: AuthPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('category') category?: 'image' | 'video' | 'file',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('uploader') uploader?: string,
  ) {
    return this.fileService.list(user.tenantId!, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      category,
      startTime,
      endTime,
      uploader,
    });
  }

  @Get('files/stats')
  getFileStats(@CurrentUser() user: AuthPayload) {
    return this.fileService.getStats(user.tenantId!);
  }

  @Delete('files/:id')
  deleteFile(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.fileService.delete(user.tenantId!, id);
  }

  @Get('quick-replies')
  listQuickReplies(@CurrentUser() user: AuthPayload) {
    return this.tenantAdminService.listQuickReplies(user.tenantId!);
  }

  @Post('quick-replies')
  createQuickReply(
    @CurrentUser() user: AuthPayload,
    @Body() body: { title: string; content: string; shortcut?: string },
  ) {
    return this.tenantAdminService.createQuickReply(user.tenantId!, body);
  }

  @Patch('quick-replies/:id')
  updateQuickReply(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; shortcut?: string },
  ) {
    return this.tenantAdminService.updateQuickReply(user.tenantId!, id, body);
  }

  @Delete('quick-replies/:id')
  deleteQuickReply(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.tenantAdminService.deleteQuickReply(user.tenantId!, id);
  }
}
