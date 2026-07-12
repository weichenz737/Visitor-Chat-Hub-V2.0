import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MessageType } from '@prisma/client';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('session/:sessionId')
  @Roles('user', 'agent')
  listBySession(
    @CurrentUser() user: AuthPayload,
    @Param('sessionId') sessionId: string,
    @Query() query: PaginationDto,
  ) {
    return this.messageService.listBySession(
      user.tenantId!,
      sessionId,
      query,
      user.role,
      user.sub,
    );
  }

  @Post()
  @Roles('user', 'agent')
  async create(
    @CurrentUser() user: AuthPayload,
    @Body()
    body: {
      sessionId: string;
      type?: MessageType;
      content: string;
      file_name?: string;
      file_size?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const result = await this.messageService.create(user.tenantId!, {
      sessionId: body.sessionId,
      senderType: user.role === 'agent' ? 'AGENT' : 'USER',
      senderId: user.sub,
      type: body.type,
      content: body.content,
      fileName: body.file_name,
      fileSize: body.file_size,
      metadata: body.metadata,
    });
    return result;
  }

  @Patch(':id/read')
  @Roles('user', 'agent')
  markRead(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.messageService.markRead(
      user.tenantId!,
      id,
      user.role,
      user.sub,
    );
  }
}
