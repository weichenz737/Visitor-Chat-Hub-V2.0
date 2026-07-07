import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QuickReplyService } from './quick-reply.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';

@Controller('quick-replies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('agent')
export class QuickReplyController {
  constructor(private readonly quickReplyService: QuickReplyService) {}

  @Get()
  list(@CurrentUser() user: AuthPayload) {
    return this.quickReplyService.list(user.tenantId!, user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPayload,
    @Body() body: { title: string; content: string; shortcut?: string },
  ) {
    return this.quickReplyService.createPersonal(user.tenantId!, user.sub, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; shortcut?: string },
  ) {
    return this.quickReplyService.updatePersonal(
      user.tenantId!,
      user.sub,
      id,
      body,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.quickReplyService.removePersonal(user.tenantId!, user.sub, id);
  }
}
