import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { MessageSenderType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import type { AuthPayload } from '../../common/decorators/auth.decorator';
import { v4 as uuidv4 } from 'uuid';
import { decodeFileName, fixFileNameEncoding } from '../../common/utils/file-message.util';
import {
  ALLOWED_UPLOAD_TYPES,
  assertFileMagicMatchesExtension,
} from '../../common/utils/upload-types';
import { FileService } from '../file/file.service';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'agent')
export class UploadController {
  constructor(
    private readonly config: ConfigService,
    private readonly fileService: FileService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const user = (req as { user?: AuthPayload }).user;
          const tenantId = user?.tenantId ?? 'unknown';
          const now = new Date();
          const dir = join(
            process.cwd(),
            process.env.UPLOAD_DIR ?? './uploads',
            tenantId,
            String(now.getFullYear()),
            String(now.getMonth() + 1).padStart(2, '0'),
          );
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowedMimeTypes = ALLOWED_UPLOAD_TYPES[extension];
        if (!allowedMimeTypes?.includes(file.mimetype)) {
          cb(new BadRequestException('不支持的文件类型'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @CurrentUser() user: AuthPayload,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { body?: { file_name?: string } },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!user.tenantId) throw new BadRequestException('Missing tenant');

    try {
      assertFileMagicMatchesExtension(file.path, file.originalname);
    } catch {
      throw new BadRequestException('文件内容与扩展名不匹配');
    }

    const now = new Date();
    const relativePath = `${user.tenantId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${file.filename}`;
    const baseUrl =
      this.config.get<string>('PUBLIC_API_URL') ??
      process.env.PUBLIC_API_URL ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    const clientName = req.body?.file_name;
    const fileName =
      decodeFileName(clientName) ??
      decodeFileName(file.originalname) ??
      fixFileNameEncoding(file.originalname);

    const uploaderType: MessageSenderType = user.role === 'agent' ? 'AGENT' : 'USER';

    const record = await this.fileService.createRecord({
      tenantId: user.tenantId,
      uploaderType,
      uploaderId: user.sub,
      fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: relativePath,
      url: '',
    });

    const fileUrl = `${baseUrl.replace(/\/$/, '')}/files/${record.id}`;
    await this.fileService.updateUrl(record.id, fileUrl);

    return {
      url: fileUrl,
      file_url: fileUrl,
      filename: fileName,
      file_name: fileName,
      size: file.size,
      file_size: file.size,
      mimeType: file.mimetype,
      id: record.id,
    };
  }
}
