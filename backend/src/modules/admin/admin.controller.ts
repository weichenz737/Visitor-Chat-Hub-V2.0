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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { OperationLogService } from './operation-log.service';
import { ChatAdminService } from '../chat-admin/chat-admin.service';
import { FileService } from '../file/file.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

function getLogContext(req: Request, user: AuthPayload) {
  return {
    adminId: user.sub,
    adminEmail: user.email ?? 'admin',
    ip: req.ip || req.headers['x-forwarded-for']?.toString(),
    userAgent: req.headers['user-agent'],
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly operationLogService: OperationLogService,
    private readonly chatAdminService: ChatAdminService,
    private readonly fileService: FileService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('tenants')
  listTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: TenantStatus,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.adminService.listTenants({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      status,
      sortField,
      sortOrder,
    });
  }

  @Get('tenants/:tenantCode')
  getTenant(@Param('tenantCode') tenantCode: string) {
    return this.adminService.getTenant(tenantCode);
  }

  @Post('tenants')
  createTenant(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Body()
    body: {
      name: string;
      tenantCode: string;
      slug: string;
      adminEmail: string;
      adminPassword: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
    },
  ) {
    return this.adminService.createTenant(body, getLogContext(req, user));
  }

  @Patch('tenants/:tenantCode')
  updateTenant(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Body()
    body: {
      name?: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
      status?: TenantStatus;
      domain?: string;
    },
  ) {
    return this.adminService.updateTenant(tenantCode, body, getLogContext(req, user));
  }

  @Patch('tenants/:tenantCode/status')
  updateTenantStatus(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Body() body: { status: TenantStatus },
  ) {
    return this.adminService.updateTenantStatus(tenantCode, body.status, getLogContext(req, user));
  }

  @Delete('tenants/:tenantCode')
  deleteTenant(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.adminService.deleteTenant(tenantCode, getLogContext(req, user));
  }

  @Post('tenants/:tenantCode/regenerate-api-key')
  regenerateApiKey(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.adminService.regenerateApiKey(tenantCode, getLogContext(req, user));
  }

  @Get('tenants/:tenantCode/agents')
  listTenantAgents(
    @Param('tenantCode') tenantCode: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('accountStatus') accountStatus?: string,
  ) {
    return this.adminService.listTenantAgents(tenantCode, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      accountStatus,
    });
  }

  @Post('tenants/:tenantCode/agents')
  createAgent(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
  ) {
    return this.adminService.createAgent(tenantCode, body, getLogContext(req, user));
  }

  @Patch('tenants/:tenantCode/agents/:agentId')
  updateAgent(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Param('agentId') agentId: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      role?: 'AGENT' | 'SUPERVISOR' | 'TENANT_ADMIN';
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      remark?: string;
    },
  ) {
    return this.adminService.updateAgent(tenantCode, agentId, body, getLogContext(req, user));
  }

  @Post('tenants/:tenantCode/agents/:agentId/reset-password')
  resetPassword(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Param('agentId') agentId: string,
    @Body() body: { password: string },
  ) {
    return this.adminService.resetAgentPassword(
      tenantCode,
      agentId,
      body.password,
      getLogContext(req, user),
    );
  }

  @Delete('tenants/:tenantCode/agents/:agentId')
  deleteAgent(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Param('agentId') agentId: string,
  ) {
    return this.adminService.deleteAgent(tenantCode, agentId, getLogContext(req, user));
  }

  @Get('tenants/:tenantCode/quick-replies')
  listTenantQuickReplies(@Param('tenantCode') tenantCode: string) {
    return this.adminService.listTenantQuickReplies(tenantCode);
  }

  @Post('tenants/:tenantCode/quick-replies')
  createTenantQuickReply(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Body() body: { title: string; content: string; shortcut?: string },
  ) {
    return this.adminService.createTenantQuickReply(
      tenantCode,
      body,
      getLogContext(req, user),
    );
  }

  @Patch('tenants/:tenantCode/quick-replies/:id')
  updateTenantQuickReply(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; shortcut?: string },
  ) {
    return this.adminService.updateTenantQuickReply(
      tenantCode,
      id,
      body,
      getLogContext(req, user),
    );
  }

  @Delete('tenants/:tenantCode/quick-replies/:id')
  deleteTenantQuickReply(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteTenantQuickReply(
      tenantCode,
      id,
      getLogContext(req, user),
    );
  }

  @Get('tenants/:tenantCode/settings')
  getTenantSettings(@Param('tenantCode') tenantCode: string) {
    return this.adminService.getTenantSettings(tenantCode);
  }

  @Put('tenants/:tenantCode/settings')
  updateTenantSettings(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('tenantCode') tenantCode: string,
    @Body() body: Record<string, string>,
  ) {
    return this.adminService.updateTenantSettings(
      tenantCode,
      body,
      getLogContext(req, user),
    );
  }

  @Get('login-logs')
  listLoginLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('success') success?: string,
  ) {
    return this.adminService.listLoginLogs({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      success: success === undefined ? undefined : success === 'true',
    });
  }

  @Get('agents')
  listAllAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('onlineOnly') onlineOnly?: string,
    @Query('suspendedOnly') suspendedOnly?: string,
  ) {
    return this.adminService.listAllAgents({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      onlineOnly: onlineOnly === 'true',
      suspendedOnly: suspendedOnly === 'true',
    });
  }

  @Get('sessions')
  listSessions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'ACTIVE' | 'CLOSED' | 'WAITING' | 'current',
    @Query('tenantCode') tenantCode?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminService.listSessions({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      status,
      tenantCode,
      keyword,
    });
  }

  @Get('sessions/:id/messages')
  getSessionMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSessionMessages(
      id,
      page ? +page : 1,
      limit ? +limit : 50,
    );
  }

  @Get('chat-users')
  listChatUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('tenantCode') tenantCode?: string,
  ) {
    return this.chatAdminService.listChatUsers(undefined, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      tenantCode,
    });
  }

  @Get('chat-users/:userId/messages')
  getChatUserMessages(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('senderType') senderType?: 'USER' | 'AGENT' | 'SYSTEM',
    @Query('content') content?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.chatAdminService.getChatUserMessages(
      undefined,
      userId,
      page ? +page : 1,
      limit ? +limit : 50,
      { senderType, content, startTime, endTime },
    );
  }

  @Delete('messages/:id')
  deleteMessage(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
  ) {
    return this.chatAdminService.deleteMessage(undefined, id).then(async (res) => {
      await this.operationLogService.create(
        getLogContext(req, user),
        '删除消息',
        id,
      );
      return res;
    });
  }

  @Patch('messages/:id')
  updateMessage(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { content?: string; fileName?: string },
  ) {
    return this.chatAdminService.updateMessage(undefined, id, body).then(async (res) => {
      await this.operationLogService.create(
        getLogContext(req, user),
        '编辑消息',
        id,
        body.content?.slice(0, 200),
      );
      return res;
    });
  }

  @Delete('chat-users/:userId/messages')
  deleteChatUserMessages(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
  ) {
    return this.chatAdminService.deleteChatUserMessages(undefined, userId).then(
      async (res) => {
        await this.operationLogService.create(
          getLogContext(req, user),
          '清空用户聊天记录',
          userId,
          `deleted=${res.deleted}`,
        );
        return res;
      },
    );
  }

  @Get('files')
  listFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('category') category?: 'image' | 'video' | 'file',
    @Query('tenantCode') tenantCode?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('uploader') uploader?: string,
  ) {
    return this.fileService.list(undefined, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
      category,
      tenantCode,
      startTime,
      endTime,
      uploader,
    });
  }

  @Get('files/stats')
  getFileStats() {
    return this.fileService.getStats();
  }

  @Delete('files/:id')
  deleteFile(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
  ) {
    return this.fileService.delete(undefined, id).then(async (res) => {
      await this.operationLogService.create(
        getLogContext(req, user),
        '删除文件',
        id,
      );
      return res;
    });
  }

  @Get('operation-logs')
  listLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.operationLogService.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      keyword,
    });
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  updateSettings(
    @Req() req: Request,
    @CurrentUser() user: AuthPayload,
    @Body() body: Record<string, string>,
  ) {
    return this.adminService.updateSettings(body, getLogContext(req, user));
  }
}
