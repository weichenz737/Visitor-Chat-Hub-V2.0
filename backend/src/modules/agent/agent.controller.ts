import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('me/profile')
  @Roles('agent')
  getMyProfile(@CurrentUser() user: AuthPayload) {
    return this.agentService.getProfile(user.tenantId!, user.sub);
  }

  @Get('me/stats')
  @Roles('agent')
  getMyStats(@CurrentUser() user: AuthPayload) {
    return this.agentService.getStats(user.tenantId!, user.sub);
  }

  @Get('me/visitor-tags')
  @Roles('agent')
  getVisitorTags(@CurrentUser() user: AuthPayload) {
    return this.agentService.getVisitorTags(user.tenantId!);
  }

  @Get('me/share-link')
  @Roles('agent')
  getShareLink(
    @CurrentUser() user: AuthPayload,
    @Headers('x-user-web-url') userWebUrl?: string,
  ) {
    const base = userWebUrl || process.env.USER_WEB_URL || 'http://localhost:5173';
    return this.agentService.getShareLink(user.tenantId!, user.sub, base);
  }

  @Patch('me/profile')
  @Roles('agent')
  updateProfile(
    @CurrentUser() user: AuthPayload,
    @Body() body: { name?: string; phone?: string; avatar?: string },
  ) {
    return this.agentService.updateProfile(user.tenantId!, user.sub, body);
  }

  @Patch('me/password')
  @Roles('agent')
  changePassword(
    @CurrentUser() user: AuthPayload,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.agentService.changePassword(
      user.tenantId!,
      user.sub,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Patch('me/status')
  @Roles('agent')
  updateMyStatus(
    @CurrentUser() user: AuthPayload,
    @Body() body: { status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY' },
  ) {
    return this.agentService.updateStatus(user.tenantId!, user.sub, body.status);
  }

  @Post('me/logout')
  @Roles('agent')
  logout(@CurrentUser() user: AuthPayload) {
    return this.agentService.goOffline(user.tenantId!, user.sub);
  }

  @Get('online')
  @Roles('agent')
  getOnline(@CurrentUser() user: AuthPayload) {
    return this.agentService.getOnlineAgents(user.tenantId!);
  }

  @Get()
  @Roles('agent', 'platform_admin')
  findAll(@CurrentUser() user: AuthPayload) {
    return this.agentService.findByTenant(user.tenantId!);
  }

  @Get(':id')
  @Roles('agent')
  findOne(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.agentService.findById(user.tenantId!, id);
  }
}
