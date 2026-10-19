import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { anggotaEventInclude, toAnggotaUpserted } from '../anggota/anggota.events.js';
import { Public } from '../auth/decorators.js';
import { InternalKeyGuard } from '../auth/guards.js';
import { notFound } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../scope/scope.service.js';

class InternalAnggotaQuery extends createZodDto(
  z.object({
    ids: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : undefined)),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
  }),
) {}

class InternalSettingQuery extends createZodDto(z.object({ prefix: z.string().optional() })) {}

class InternalIdsQuery extends createZodDto(
  z.object({ ids: z.string().transform((v) => v.split(',').filter(Boolean)) }),
) {}

/** Endpoint antar-service (header x-internal-key). Payload anggota = format event anggota.upserted. */
@Controller('internal')
@Public()
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
  ) {}

  @Get('anggota')
  async anggota(@Query() q: InternalAnggotaQuery) {
    const rows = await this.prisma.anggota.findMany({
      where: {
        ...(q.ids ? { id: { in: q.ids } } : {}),
        ...(q.updatedSince ? { updatedAt: { gte: new Date(q.updatedSince) } } : {}),
      },
      include: anggotaEventInclude,
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map(toAnggotaUpserted);
  }

  /** Pohon wilayah datar (untuk acara-svc: nama & induk tiap wilayah). */
  @Get('wilayah')
  async wilayah() {
    const [daerah, desa, kelompok] = await Promise.all([
      this.prisma.daerah.findMany({ select: { id: true, kode: true, nama: true } }),
      this.prisma.desa.findMany({ select: { id: true, kode: true, nama: true, daerahId: true } }),
      this.prisma.kelompok.findMany({ select: { id: true, kode: true, nama: true, desaId: true } }),
    ]);
    return { daerah, desa, kelompok };
  }

  /** Scope wilayah user (dipakai acara-svc untuk cek akses). */
  @Get('users/:id/scope')
  async scope(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, nama: true, email: true, role: true, aktif: true },
    });
    if (!user) throw notFound('User', id);
    const s = await this.scopes.forUser(user);
    return {
      user,
      all: s.all,
      manageDaerah: [...s.manageDaerah],
      manageDesa: [...s.manageDesa],
      manageKelompok: [...s.manageKelompok],
      visibleDaerah: [...s.visibleDaerah],
      visibleDesa: [...s.visibleDesa],
    };
  }

  @Get('users')
  users(@Query() q: InternalIdsQuery) {
    return this.prisma.user.findMany({
      where: { id: { in: q.ids } },
      select: { id: true, nama: true, role: true },
    });
  }

  @Get('setting')
  setting(@Query() q: InternalSettingQuery) {
    return this.prisma.setting.findMany({
      where: q.prefix ? { key: { startsWith: q.prefix } } : {},
    });
  }
}
