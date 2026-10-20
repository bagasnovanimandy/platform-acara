import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { normalizeWa } from '@platform-acara/shared';
import { Public, Roles } from '../auth/decorators.js';
import { InternalKeyGuard } from '../auth/internal-key.guard.js';
import { badRequest, notFound } from '../common/app-error.js';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WaService } from './wa.service.js';

class SimulasiDto extends createZodDto(
  z.object({ noWa: z.string().min(8), teks: z.string().min(1).max(2000) }),
) {}

class PesanQuery extends createZodDto(
  z.object({
    noWa: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
) {}

@Controller('wa')
export class WaController {
  constructor(
    private readonly wa: WaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  @Roles('ADMIN')
  status() {
    return this.wa.status();
  }

  /** Minta QR baru untuk menautkan nomor bot (sesi lama diputus). */
  @Post('pair')
  @HttpCode(200)
  @Roles('SUPER_ADMIN')
  async pair() {
    await this.wa.tautkanUlang();
    return this.wa.status();
  }

  /** Log pesan masuk/keluar terbaru (audit & debug). */
  @Get('pesan')
  @Roles('SUPER_ADMIN')
  pesan(@Query() q: PesanQuery) {
    const noWa = q.noWa ? normalizeWa(q.noWa) : undefined;
    return this.prisma.pesanLog.findMany({
      where: noWa ? { noWa } : {},
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
  }

  /**
   * Hanya driver `fake`: proses pesan seolah masuk dari WA, lalu kembalikan pesan yang dikirim
   * bot selama pemrosesan. Untuk pengembangan & uji otomatis.
   */
  @Post('simulasi')
  @HttpCode(200)
  @Public()
  @UseGuards(InternalKeyGuard)
  async simulasi(@Body() dto: SimulasiDto) {
    if (config().WA_DRIVER !== 'fake') throw notFound('Endpoint');
    const noWa = normalizeWa(dto.noWa);
    if (!noWa) throw badRequest('NOWA_INVALID', 'Nomor WA tidak valid');
    const sejak = new Date();
    await this.wa.terima({ noWa, teks: dto.teks });
    const keluar = await this.prisma.pesanLog.findMany({
      where: { arah: 'KELUAR', createdAt: { gte: sejak } },
      orderBy: { createdAt: 'asc' },
      select: { noWa: true, isi: true },
    });
    return { keluar };
  }
}
