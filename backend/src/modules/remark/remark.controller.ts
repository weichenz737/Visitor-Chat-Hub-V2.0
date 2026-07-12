import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RemarkService } from './remark.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

@Controller('remarks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('agent')
export class RemarkController {
  constructor(private readonly remarkService: RemarkService) {}

  @Put('user/:userId')
  upsert(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
    @Body() body: { content: string; tags?: string[] },
  ) {
    return this.remarkService.upsertForAgent(
      user.tenantId!,
      userId,
      user.sub,
      body,
    );
  }

  @Get('user/:userId/mine')
  getMine(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
  ) {
    return this.remarkService.getByAgent(user.tenantId!, userId, user.sub);
  }

  @Get('user/:userId')
  listByUser(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
  ) {
    return this.remarkService.listByUser(user.tenantId!, userId, user.sub);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { content?: string; tags?: string[] },
  ) {
    return this.remarkService.update(user.tenantId!, id, user.sub, body);
  }
}
