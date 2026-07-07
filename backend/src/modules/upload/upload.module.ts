import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [UploadController],
})
export class UploadModule {}
