import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UserService } from './user.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('me')
  @Roles('user')
  getMe(@CurrentUser() user: AuthPayload) {
    return this.userService.findById(user.tenantId!, user.sub);
  }

  @Get(':id')
  @Roles('agent', 'platform_admin')
  findOne(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    const agentId = user.role === 'agent' ? user.sub : undefined;
    return this.userService.findById(user.tenantId!, id, agentId);
  }

  @Patch('me/nickname')
  @Roles('user')
  async updateNickname(
    @CurrentUser() user: AuthPayload,
    @Body() body: { nickname: string },
  ) {
    const result = await this.userService.updateNickname(
      user.tenantId!,
      user.sub,
      body.nickname,
    );
    const gateway = this.moduleRef.get(ChatGateway, { strict: false });
    await gateway?.notifyUserProfileUpdated(user.tenantId!, result.id, {
      nickname: result.nickname ?? body.nickname.trim(),
      originalName: result.originalName,
    });
    return result;
  }
}
