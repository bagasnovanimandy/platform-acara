import { Injectable } from '@nestjs/common';
import { auditScopeWhere } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kelompokFilter } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import { aktivitas, ringkasan } from './dashboard.js';

const DAY = 86_400_000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
  ) {}

  async ringkasan(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const kf = kelompokFilter(scope);
    const now = new Date();
    const sejak = new Date(now.getTime() - 400 * DAY);
    const anggotaWhere: Prisma.AnggotaWhereInput = kf ? { kelompokId: kf } : {};

    const [anggota, kelompok, kategori, perKategori, mutasi] = await Promise.all([
      this.prisma.anggota.findMany({
        where: anggotaWhere,
        select: {
          status: true,
          jenisKelamin: true,
          kelompokId: true,
          noWa: true,
          tanggalLahir: true,
          createdAt: true,
          _count: { select: { kategori: true, wali: true } },
        },
      }),
      this.prisma.kelompok.findMany({
        where: kf ? { id: kf } : {},
        select: { id: true, nama: true, desaId: true, desa: { select: { nama: true } } },
      }),
      this.prisma.kategori.findMany({
        select: { id: true, nama: true, warna: true, urutan: true, aktif: true },
      }),
      this.prisma.anggotaKategori.groupBy({
        by: ['kategoriId'],
        where: { anggota: { ...anggotaWhere, status: 'AKTIF' } },
        _count: { _all: true },
      }),
      this.prisma.mutasiSambung.findMany({
        where: {
          tanggal: { gte: sejak },
          ...(kf ? { OR: [{ dariKelompokId: kf }, { keKelompokId: kf }] } : {}),
        },
        select: { tanggal: true, dariKelompokId: true, keKelompokId: true },
      }),
    ]);

    return ringkasan({
      anggota: anggota.map(({ _count, ...a }) => ({
        ...a,
        jumlahKategori: _count.kategori,
        jumlahWali: _count.wali,
      })),
      kelompok: kelompok.map((k) => ({
        id: k.id,
        nama: k.nama,
        desaId: k.desaId,
        namaDesa: k.desa.nama,
      })),
      kategori,
      jumlahPerKategori: new Map(perKategori.map((p) => [p.kategoriId, p._count._all])),
      mutasi,
      kelompokScope: kf ? new Set(kf.in) : null,
      now,
    });
  }

  async audit(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const now = new Date();
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        auditScopeWhere(scope) ?? {},
        { createdAt: { gte: new Date(now.getTime() - 31 * DAY) } },
      ],
    };
    const [rows, terbaru] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: { aksi: true, entitas: true, userId: true, userNama: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: auditScopeWhere(scope) ?? {},
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return { ...aktivitas(rows, now), terbaru };
  }
}
