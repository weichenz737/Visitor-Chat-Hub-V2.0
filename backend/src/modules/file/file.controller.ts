import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { FileService } from './file.service';
import { SessionAuthorizationService } from '../session/session-authorization.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'agent', 'tenant_admin', 'platform_admin')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly sessionAuthorization: SessionAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  /** Legacy messages that still store /uploads/... URLs */
  @Get('legacy')
  async downloadLegacy(
    @CurrentUser() user: AuthPayload,
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!path?.trim()) throw new NotFoundException('文件不存在');
    const record = await this.fileService.findByIdOrUrl(path.trim(), user.tenantId);
    if (!record) throw new NotFoundException('文件不存在');
    return this.streamFile(user, record, res);
  }

  @Get(':id')
  async download(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.fileService.findByIdOrUrl(id, user.tenantId);
    if (!record) throw new NotFoundException('文件不存在');
    return this.streamFile(user, record, res);
  }

  private async streamFile(
    user: AuthPayload,
    record: {
      id: string;
      tenantId: string;
      url: string;
      uploaderId: string | null;
      mimeType: string;
      fileName: string;
      storagePath: string;
    },
    res: Response,
  ) {
    await this.assertCanDownload(user, record);

    const absolutePath = this.fileService.resolveAbsolutePath(record.storagePath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('文件已丢失');
    }

    res.set({
      'Content-Type': record.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
      'Cache-Control': 'private, max-age=60',
    });

    return new StreamableFile(createReadStream(absolutePath));
  }

  private async assertCanDownload(
    user: AuthPayload,
    record: {
      id: string;
      tenantId: string;
      url: string;
      uploaderId: string | null;
      storagePath: string;
    },
  ) {
    if (user.role === 'platform_admin') return;

    if (!user.tenantId || user.tenantId !== record.tenantId) {
      throw new ForbiddenException('无权访问此文件');
    }

    if (user.role === 'tenant_admin') return;

    if (record.uploaderId && record.uploaderId === user.sub) return;

    const message = await this.prisma.message.findFirst({
      where: {
        tenantId: record.tenantId,
        OR: [
          { content: record.url },
          { content: { endsWith: `/files/${record.id}` } },
          { content: { endsWith: `/uploads/${record.storagePath}` } },
        ],
        type: { in: ['IMAGE', 'VIDEO', 'FILE'] },
      },
      select: { sessionId: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!message) {
      throw new ForbiddenException('无权访问此文件');
    }

    await this.sessionAuthorization.assertActorAccess(
      record.tenantId,
      message.sessionId,
      user.role,
      user.sub,
    );
  }
}
