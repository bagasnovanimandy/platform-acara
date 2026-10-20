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
      select: { id: true, nama: true, role: true, noWa: true, aktif: true },
    });
  }

  /**
   * Pengurus aktif terdekat untuk satu kelompok: scope kelompok itu, bila tidak ada desanya,
   * bila tidak ada daerahnya. Tujuan pengajuan izin bila acara tidak punya PJ izin.
   */
  @Get('kelompok/:id/pengurus')
  async pengurusKelompok(@Param('id') id: string) {
    const k = await this.prisma.kelompok.findUnique({
      where: { id },
      select: { id: true, desaId: true, desa: { select: { daerahId: true } } },
    });
    if (!k) throw notFound('Kelompok', id);
    const tingkat = [
      { level: 'KELOMPOK' as const, refId: k.id },
      { level: 'DESA' as const, refId: k.desaId },
      { level: 'DAERAH' as const, refId: k.desa.daerahId },
    ];
    for (const t of tingkat) {
      const users = await this.prisma.user.findMany({
        where: { role: 'PENGURUS', aktif: true, scopes: { some: t } },
        select: { id: true, nama: true, role: true, noWa: true, aktif: true },
        orderBy: { nama: 'asc' },
      });
      if (users.length) return users;
    }
    return [];
  }

  /** User dengan nomor WA ini (pengurus yang membalas SETUJU/TOLAK lewat bot). */
  @Get('users/by-wa/:noWa')
  async byWa(@Param('noWa') noWa: string) {
    const user = await this.prisma.user.findUnique({
      where: { noWa },
      select: { id: true, nama: true, role: true, aktif: true },
    });
    if (!user) throw notFound('User', noWa);
    return user;
  }

  @Get('setting')
  setting(@Query() q: InternalSettingQuery) {
    return this.prisma.setting.findMany({
      where: q.prefix ? { key: { startsWith: q.prefix } } : {},
    });
  }
}
