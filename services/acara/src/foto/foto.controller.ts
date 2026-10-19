import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { FotoService } from './foto.service.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Controller()
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class FotoController {
  constructor(private readonly foto: FotoService) {}

  @Get('acara/:id/foto')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.foto.list(user, id);
  }

  @Post('acara/:id/foto')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() body: { caption?: string; sesiId?: string },
  ) {
    return this.foto.upload(user, id, file.buffer, {
      caption: typeof body.caption === 'string' ? body.caption : undefined,
      sesiId: typeof body.sesiId === 'string' && body.sesiId ? body.sesiId : undefined,
    });
  }

  @Get('foto/:id/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('thumb') thumb: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const path = await this.foto.filePath(user, id, thumb === '1' || thumb === 'true');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.type('image/webp').sendFile(path);
  }

  @Delete('foto/:id')
  @HttpCode(204)
  @Roles('ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.foto.remove(user, id);
  }
}
