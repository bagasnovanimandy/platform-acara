import { Injectable } from '@nestjs/common';
import { canSeeAcara } from '../acara/acara.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../scope/scope.service.js';
import { type BarisKehadiran, statistikKehadiran } from './kehadiran.js';
import { type AcaraRow, statistikAcara } from './statistik.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
  ) {}

  async acara(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const rows = await this.prisma.acara.findMany({
      where: { deletedAt: null },
      include: {
        pesertaRules: true,
        _count: { select: { sesi: { where: { deletedAt: null } } } },
      },
    });
    const visible: AcaraRow[] = rows
      .filter((a) => canSeeAcara(scope, a))
      .map((a) => ({
        id: a.id,
        nama: a.nama,
        status: a.status,
        tingkat: a.tingkat,
        lokasi: a.lokasi,
        tanggalMulai: a.tanggalMulai,
        tanggalSelesai: a.tanggalSelesai,
        jumlahSesi: a._count.sesi,
      }));
    return statistikAcara(visible, new Date());
  }

  /**
   * Kehadiran dari rekap sesi yang sudah ditutup (12 bulan terakhir), hanya peserta di
   * wilayah user (wilayah dari snapshot peserta saat sesi ditutup).
   */
  async kehadiran(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const now = new Date();
    const sejak = new Date(now.getTime() - 366 * 864e5);
    const peserta = await this.prisma.pesertaSesi.findMany({
      where: {
        sesi: {
          deletedAt: null,
          ditutupAt: { not: null },
          mulai: { gte: sejak },
          acara: { deletedAt: null },
        },
        ...(scope.all ? {} : { kelompokId: { in: [...scope.manageKelompok] } }),
      },
      select: { sesiId: true, anggotaId: true },
    });
    const sesiIds = [...new Set(peserta.map((p) => p.sesiId))];
    const [rekap, sesi, anggota] = await Promise.all([
      this.prisma.rekap.findMany({ where: { sesiId: { in: sesiIds } } }),
      this.prisma.sesi.findMany({
        where: { id: { in: sesiIds } },
        select: { id: true, nama: true, mulai: true, acara: { select: { id: true, nama: true } } },
      }),
      this.prisma.anggotaRef.findMany({
        where: { id: { in: [...new Set(peserta.map((p) => p.anggotaId))] } },
        select: { id: true, kategori: true },
      }),
    ]);
    const boleh = new Set(peserta.map((p) => `${p.sesiId}:${p.anggotaId}`));
    const sesiBy = new Map(sesi.map((s) => [s.id, s]));
    const kategoriBy = new Map(anggota.map((a) => [a.id, a.kategori]));
    const rows: BarisKehadiran[] = [];
    for (const r of rekap) {
      const s = sesiBy.get(r.sesiId);
      if (!s || !boleh.has(`${r.sesiId}:${r.anggotaId}`)) continue;
      rows.push({
        sesiId: s.id,
        sesiNama: s.nama,
        acaraId: s.acara.id,
        acaraNama: s.acara.nama,
        mulai: s.mulai,
        status: r.status,
        terlambat: r.terlambat,
        kategori: kategoriBy.get(r.anggotaId) ?? [],
      });
    }
    return statistikKehadiran(rows, now);
  }
}
