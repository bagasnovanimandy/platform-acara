import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { isPeserta } from '../acara/peserta.js';
import { Public } from '../auth/decorators.js';
import { notFound } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InternalKeyGuard } from './internal-key.guard.js';

class SesiMendatangQuery extends createZodDto(
  z.object({ hari: z.coerce.number().int().min(1).max(60).default(14) }),
) {}

/** Endpoint antar-service untuk wabot-svc (header x-internal-key). */
@Controller('internal')
@Public()
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sesi yang akan datang (belum lewat batas izin) dalam `hari` ke depan yang diikuti anggota.
   * Dipakai bot WA untuk menu "Ajukan izin" dan "Jadwal acara terdekat".
   */
  @Get('anggota/:id/sesi')
  async sesiMendatang(@Param('id') id: string, @Query() q: SesiMendatangQuery) {
    const a = await this.prisma.anggotaRef.findUnique({ where: { id } });
    if (!a) throw notFound('Anggota', id);
    const now = new Date();
    const sampai = new Date(now.getTime() + q.hari * 86_400_000);
    const acara = await this.prisma.acara.findMany({
      where: {
        deletedAt: null,
        status: { in: ['TERJADWAL', 'BERLANGSUNG'] },
        pesertaRules: {
          some: { OR: [{ refId: a.kelompokId }, { refId: a.desaId }, { refId: a.daerahId }] },
        },
        sesi: { some: { deletedAt: null, mulai: { gt: now, lte: sampai } } },
      },
      include: {
        pesertaRules: true,
        sesi: {
          where: { deletedAt: null, status: { not: 'DITUTUP' }, mulai: { gt: now, lte: sampai } },
          orderBy: { mulai: 'asc' },
        },
      },
    });
    return acara
      .filter((x) => isPeserta(a, x.pesertaRules))
      .flatMap((x) =>
        x.sesi.map((s) => ({
          acara: { id: x.id, nama: x.nama, lokasi: x.lokasi },
          sesi: {
            id: s.id,
            nama: s.nama,
            mulai: s.mulai,
            selesai: s.selesai,
            batasIzin: s.batasIzin ?? s.mulai,
          },
        })),
      )
      .sort((p, r) => p.sesi.mulai.getTime() - r.sesi.mulai.getTime());
  }

  /** Penanggung jawab acara (untuk meneruskan pengajuan izin). */
  @Get('acara/:id/pj')
  async pj(@Param('id') id: string) {
    const a = await this.prisma.acara.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pj: { select: { userId: true, nama: true, peran: true } } },
    });
    if (!a) throw notFound('Acara', id);
    return a.pj;
  }
}
