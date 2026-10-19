import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
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
import {
  CreateAnggotaDto,
  ImportQuery,
  ListAnggotaQuery,
  MutasiDto,
  UpdateAnggotaDto,
} from './anggota.dto.js';
import { AnggotaService } from './anggota.service.js';
import { importTemplateXlsx, readImportXlsx } from './xlsx.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('anggota')
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class AnggotaController {
  constructor(private readonly anggota: AnggotaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListAnggotaQuery) {
    return this.anggota.list(user, q);
  }

  @Get('import/template')
  @Roles('ADMIN')
  async template(@Res() res: Response): Promise<void> {
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('template-import-anggota.xlsx')
      .send(await importTemplateXlsx(await this.anggota.namaKategoriAktif()));
  }

  /** `?dryRun=true` hanya memvalidasi; tanpa itu baris valid langsung disimpan. */
  @Post('import')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async import(
    @CurrentUser() user: AuthUser,
    @Query() q: ImportQuery,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
  ) {
    const { rows, firstRow } = await readImportXlsx(file.buffer);
    return this.anggota.import(user, rows, firstRow, q.dryRun);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.anggota.get(user, id);
  }

  @Get(':id/riwayat')
  riwayat(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.anggota.riwayat(user, id);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAnggotaDto) {
    return this.anggota.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAnggotaDto) {
    return this.anggota.update(user, id, dto);
  }

  @Post(':id/mutasi')
  @Roles('ADMIN')
  mutasi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MutasiDto) {
    return this.anggota.mutasi(user, id, dto);
  }
}
