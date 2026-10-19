import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import {
  CariAnggotaQuery,
  CreateAcaraDto,
  CreatePjDto,
  ListAcaraQuery,
  ListPesertaQuery,
  PreviewPesertaDto,
  UpdateAcaraDto,
} from './acara.dto.js';
import { AcaraService } from './acara.service.js';

@Controller('acara')
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class AcaraController {
  constructor(private readonly acara: AcaraService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListAcaraQuery) {
    return this.acara.list(user, q);
  }

  @Post('peserta/preview')
  @HttpCode(200)
  @Roles('ADMIN')
  preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewPesertaDto) {
    return this.acara.preview(user, dto);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAcaraDto) {
    return this.acara.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acara.get(user, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAcaraDto) {
    return this.acara.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acara.remove(user, id);
  }

  @Get(':id/peserta')
  peserta(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: ListPesertaQuery) {
    return this.acara.peserta(user, id, q);
  }

  @Post(':id/pj')
  @Roles('ADMIN')
  addPj(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreatePjDto) {
    return this.acara.addPj(user, id, dto);
  }

  @Delete(':id/pj/:pjId')
  @Roles('ADMIN')
  removePj(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pjId') pjId: string) {
    return this.acara.removePj(user, id, pjId);
  }
}

@Controller()
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class AnggotaAcaraController {
  constructor(private readonly acara: AcaraService) {}

  /** Riwayat acara seorang anggota. */
  @Get('anggota/:id/acara')
  riwayat(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.acara.riwayatAnggota(user, id);
  }

  /** Cari anggota untuk pengisi rundown. */
  @Get('anggota-ref/cari')
  @Roles('ADMIN')
  cari(@Query() q: CariAnggotaQuery) {
    return this.acara.cariAnggota(q);
  }
}
