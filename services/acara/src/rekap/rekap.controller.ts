import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { RekapQuery, SusulanDto } from './rekap.dto.js';
import { RekapService } from './rekap.service.js';
import { rekapAcaraXlsx, rekapSesiXlsx } from './xlsx.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Nama file aman: huruf, angka, dan tanda hubung. */
const namaFile = (...bagian: string[]) =>
  `${bagian
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)}.xlsx`;

@Controller()
@Roles('ADMIN', 'PENGURUS', 'AUDITOR')
export class RekapController {
  constructor(private readonly rekap: RekapService) {}

  @Get('sesi/:id/rekap')
  sesi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: RekapQuery) {
    return this.rekap.sesiRekap(user, id, q);
  }

  @Get('sesi/:id/rekap.xlsx')
  async sesiXlsx(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: RekapQuery,
    @Res() res: Response,
  ): Promise<void> {
    const r = await this.rekap.sesiRekap(user, id, q);
    const wilayah = await this.rekap.labelFilter(q);
    res
      .type(XLSX)
      .attachment(namaFile('rekap', r.acara.nama, r.sesi.nama, wilayah ?? ''))
      .send(await rekapSesiXlsx(r, wilayah));
  }

  @Get('acara/:id/rekap')
  acara(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: RekapQuery) {
    return this.rekap.acaraRekap(user, id, q);
  }

  @Get('acara/:id/rekap.xlsx')
  async acaraXlsx(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: RekapQuery,
    @Res() res: Response,
  ): Promise<void> {
    const r = await this.rekap.acaraRekap(user, id, q);
    const wilayah = await this.rekap.labelFilter(q);
    res
      .type(XLSX)
      .attachment(namaFile('rekap', r.acara.nama, wilayah ?? ''))
      .send(await rekapAcaraXlsx(r, wilayah));
  }

  @Get('anggota/:id/kehadiran')
  anggota(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rekap.riwayatAnggota(user, id);
  }

  @Post('sesi/:id/tutup')
  @HttpCode(200)
  @Roles('ADMIN')
  tutup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rekap.tutup(user, id);
  }

  @Post('sesi/:id/rekap/hitung-ulang')
  @HttpCode(200)
  @Roles('ADMIN')
  hitungUlang(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rekap.hitungUlang(user, id);
  }

  /** Absensi susulan oleh admin. */
  @Post('sesi/:id/absensi')
  @HttpCode(200)
  @Roles('ADMIN')
  susulan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SusulanDto) {
    return this.rekap.susulan(user, id, dto);
  }
}
