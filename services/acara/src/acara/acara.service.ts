import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { badRequest, forbiddenScope, notFound } from '../common/app-error.js';
import { type Paginated, skipTake } from '../common/pagination.js';
import { CoreClient } from '../core/core.client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManage, type Level, overlaps, type Scope, type WilayahTree } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type {
  CariAnggotaQuery,
  CreateAcaraDto,
  CreatePjDto,
  ListAcaraQuery,
  ListPesertaQuery,
  PreviewPesertaDto,
  UpdateAcaraDto,
} from './acara.dto.js';
import { isPeserta, penyelenggara, pesertaWhere, type Rule, validateTingkat } from './peserta.js';

type Peserta = PreviewPesertaDto;

export function namaWilayah(tree: WilayahTree, level: string, id: string): string {
  const list = level === 'DAERAH' ? tree.daerah : level === 'DESA' ? tree.desa : tree.kelompok;
  return list.find((x) => x.id === id)?.nama ?? '(wilayah tidak dikenal)';
}

const canWrite = (u: AuthUser) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';

type AcaraAccess = { penyelenggaraLevel: string; penyelenggaraId: string; pesertaRules: Rule[] };

/** Terlihat bila penyelenggara di wilayah user, atau salah satu wilayah peserta bersinggungan. */
export function canSeeAcara(s: Scope, a: AcaraAccess): boolean {
  return (
    canManage(s, { level: a.penyelenggaraLevel as Level, id: a.penyelenggaraId }) ||
    a.pesertaRules.some((r) => overlaps(s, { level: r.level as Level, id: r.refId }))
  );
}

/** Filter Prisma kasar untuk daftar acara; dipersempit lagi dengan canSeeAcara. */
function scopeWhere(s: Scope): Prisma.AcaraWhereInput | undefined {
  if (s.all) return undefined;
  const ids = [
    ...s.manageDaerah,
    ...s.manageDesa,
    ...s.manageKelompok,
    ...s.visibleDaerah,
    ...s.visibleDesa,
  ];
  return {
    OR: [{ penyelenggaraId: { in: ids } }, { pesertaRules: { some: { refId: { in: ids } } } }],
  };
}

@Injectable()
export class AcaraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly core: CoreClient,
  ) {}

  async list(user: AuthUser, q: ListAcaraQuery): Promise<Paginated<unknown>> {
    const scope = await this.scopes.forUser(user);
    const and: Prisma.AcaraWhereInput[] = [{ deletedAt: null }];
    const sw = scopeWhere(scope);
    if (sw) and.push(sw);
    if (q.q) and.push({ nama: { contains: q.q, mode: 'insensitive' } });
    if (q.status) and.push({ status: q.status });
    if (q.tingkat) and.push({ tingkat: q.tingkat });
    if (q.dari) and.push({ tanggalSelesai: { gte: new Date(q.dari) } });
    if (q.sampai) and.push({ tanggalMulai: { lte: new Date(q.sampai) } });
    const where = { AND: and };
    const [items, total, tree] = await Promise.all([
      this.prisma.acara.findMany({
        where,
        include: {
          pesertaRules: true,
          _count: { select: { sesi: { where: { deletedAt: null } } } },
        },
        orderBy: { tanggalMulai: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.acara.count({ where }),
      this.core.wilayah(),
    ]);
    return {
      items: items
        .filter((a) => canSeeAcara(scope, a))
        .map((a) => this.withNames(a, tree, scope, user)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(user: AuthUser, id: string) {
    const scope = await this.scopes.forUser(user);
    const a = await this.prisma.acara.findFirst({
      where: { id, deletedAt: null },
      include: {
        pesertaRules: true,
        pj: { orderBy: { peran: 'asc' } },
        sesi: {
          where: { deletedAt: null },
          orderBy: { mulai: 'asc' },
          include: {
            rundown: { orderBy: { urutan: 'asc' }, include: { pengisi: true } },
          },
        },
      },
    });
    if (!a || !canSeeAcara(scope, a)) throw notFound('Acara', id);
    const [tree, jumlahPeserta, pengisiAnggota] = await Promise.all([
      this.core.wilayah(),
      this.prisma.anggotaRef.count({ where: pesertaWhere(a.pesertaRules) }),
      this.prisma.anggotaRef.findMany({
        where: {
          id: {
            in: a.sesi.flatMap((s) =>
              s.rundown.flatMap((r) => r.pengisi.map((p) => p.anggotaId).filter((x) => x !== null)),
            ),
          },
        },
        select: { id: true, kode: true, nama: true, namaKelompok: true },
      }),
    ]);
    const byId = new Map(pengisiAnggota.map((p) => [p.id, p]));
    return {
      ...this.withNames(a, tree, scope, user),
      jumlahPeserta,
      sesi: a.sesi.map((s) => ({
        ...s,
        rundown: s.rundown.map((r) => ({
          ...r,
          pengisi: r.pengisi.map((p) => ({
            ...p,
            anggota: p.anggotaId ? (byId.get(p.anggotaId) ?? null) : null,
          })),
        })),
      })),
    };
  }

  /** Hitung peserta sebelum acara disimpan, beserta rincian per wilayah & kategori. */
  async preview(user: AuthUser, dto: PreviewPesertaDto) {
    const scope = await this.scopes.forUser(user);
    const tree = await this.core.wilayah();
    this.assertPeserta(scope, dto, tree);
    const rules = this.toRules(dto);
    const where = pesertaWhere(rules);
    const [total, perKelompok, perJk, contoh] = await Promise.all([
      this.prisma.anggotaRef.count({ where }),
      this.prisma.anggotaRef.groupBy({
        by: ['kelompokId', 'namaKelompok', 'namaDesa'],
        where,
        _count: { _all: true },
        orderBy: { _count: { kelompokId: 'desc' } },
      }),
      this.prisma.anggotaRef.groupBy({ by: ['jenisKelamin'], where, _count: { _all: true } }),
      this.prisma.anggotaRef.findMany({
        where,
        take: 8,
        orderBy: { nama: 'asc' },
        select: { id: true, kode: true, nama: true, namaKelompok: true, kategori: true },
      }),
    ]);
    const perKategori: Record<string, number> = {};
    if (dto.kategori.length) {
      const rows = await this.prisma.anggotaRef.findMany({ where, select: { kategori: true } });
      for (const r of rows)
        for (const k of r.kategori)
          if (dto.kategori.includes(k)) perKategori[k] = (perKategori[k] ?? 0) + 1;
    }
    return {
      total,
      penyelenggara: penyelenggara(dto.wilayah, tree),
      perKelompok: perKelompok.map((k) => ({
        kelompokId: k.kelompokId,
        namaKelompok: k.namaKelompok,
        namaDesa: k.namaDesa,
        jumlah: k._count._all,
      })),
      perJenisKelamin: Object.fromEntries(perJk.map((r) => [r.jenisKelamin, r._count._all])),
      perKategori,
      contoh,
    };
  }

  async create(user: AuthUser, dto: CreateAcaraDto) {
    const scope = await this.scopes.forUser(user);
    const tree = await this.core.wilayah();
    const owner = this.assertPeserta(scope, dto, tree);
    this.assertWaktu(dto.tanggalMulai, dto.tanggalSelesai);
    const row = await this.prisma.acara.create({
      data: {
        nama: dto.nama,
        jenis: dto.jenis,
        deskripsi: dto.deskripsi,
        lokasi: dto.lokasi,
        tanggalMulai: dto.tanggalMulai,
        tanggalSelesai: dto.tanggalSelesai,
        status: dto.status,
        tingkat: dto.tingkat,
        penyelenggaraLevel: owner.level,
        penyelenggaraId: owner.id,
        dibuatOleh: user.id,
        pesertaRules: { create: this.toRules(dto) },
      },
    });
    return this.get(user, row.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateAcaraDto) {
    const { scope, acara } = await this.manageable(user, id);
    const { tingkat, wilayah, jenisKelamin, kategori, ...fields } = dto;
    const mulai = fields.tanggalMulai ?? acara.tanggalMulai.toISOString();
    const selesai = fields.tanggalSelesai ?? acara.tanggalSelesai.toISOString();
    this.assertWaktu(mulai, selesai);
    let pesertaData: Prisma.AcaraUpdateInput = {};
    if (tingkat || wilayah || jenisKelamin !== undefined || kategori) {
      const first = acara.pesertaRules[0];
      const peserta: Peserta = {
        tingkat: tingkat ?? acara.tingkat,
        wilayah:
          wilayah ?? acara.pesertaRules.map((r) => ({ level: r.level as Level, id: r.refId })),
        jenisKelamin:
          jenisKelamin === undefined ? (first?.jenisKelamin as 'L' | 'P' | null) : jenisKelamin,
        kategori: kategori ?? first?.kategori ?? [],
      };
      const owner = this.assertPeserta(scope, peserta, await this.core.wilayah());
      pesertaData = {
        tingkat: peserta.tingkat,
        penyelenggaraLevel: owner.level,
        penyelenggaraId: owner.id,
        pesertaRules: { deleteMany: {}, create: this.toRules(peserta) },
      };
    }
    await this.prisma.acara.update({ where: { id }, data: { ...fields, ...pesertaData } });
    return this.get(user, id);
  }

  async remove(user: AuthUser, id: string) {
    await this.manageable(user, id);
    await this.prisma.acara.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async peserta(user: AuthUser, id: string, q: ListPesertaQuery): Promise<Paginated<unknown>> {
    const a = await this.get(user, id);
    const where: Prisma.AnggotaRefWhereInput = {
      AND: [
        pesertaWhere(a.pesertaRules),
        ...(q.q
          ? [
              {
                OR: [
                  { nama: { contains: q.q, mode: 'insensitive' as const } },
                  { kode: { contains: q.q, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.anggotaRef.findMany({
        where,
        orderBy: [{ namaDesa: 'asc' }, { namaKelompok: 'asc' }, { nama: 'asc' }],
        select: {
          id: true,
          kode: true,
          nama: true,
          jenisKelamin: true,
          namaKelompok: true,
          namaDesa: true,
          kategori: true,
        },
        ...skipTake(q),
      }),
      this.prisma.anggotaRef.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async addPj(user: AuthUser, id: string, dto: CreatePjDto) {
    await this.manageable(user, id);
    const [u] = await this.core.users([dto.userId]);
    if (!u) throw notFound('User', dto.userId);
    await this.prisma.acaraPJ.upsert({
      where: { acaraId_userId_peran: { acaraId: id, userId: dto.userId, peran: dto.peran } },
      create: {
        acaraId: id,
        userId: u.id,
        nama: u.nama,
        peran: dto.peran,
        keterangan: dto.keterangan,
      },
      update: { nama: u.nama, keterangan: dto.keterangan },
    });
    return this.get(user, id);
  }

  async removePj(user: AuthUser, id: string, pjId: string) {
    await this.manageable(user, id);
    const res = await this.prisma.acaraPJ.deleteMany({ where: { id: pjId, acaraId: id } });
    if (res.count === 0) throw notFound('PJ', pjId);
    return this.get(user, id);
  }

  /** Acara yang mengikutsertakan seorang anggota (riwayat acara di halaman detail anggota). */
  async riwayatAnggota(user: AuthUser, anggotaId: string) {
    const scope = await this.scopes.forUser(user);
    const a = await this.prisma.anggotaRef.findUnique({ where: { id: anggotaId } });
    if (!a || !canManage(scope, { level: 'KELOMPOK', id: a.kelompokId })) {
      throw notFound('Anggota', anggotaId);
    }
    const candidates = await this.prisma.acara.findMany({
      where: {
        deletedAt: null,
        pesertaRules: {
          some: { OR: [{ refId: a.kelompokId }, { refId: a.desaId }, { refId: a.daerahId }] },
        },
      },
      include: { pesertaRules: true },
      orderBy: { tanggalMulai: 'desc' },
      take: 200,
    });
    return candidates
      .filter((x) => isPeserta(a, x.pesertaRules))
      .map(({ pesertaRules: _r, ...x }) => x);
  }

  /** Cari anggota (untuk pengisi rundown). */
  async cariAnggota(q: CariAnggotaQuery) {
    return this.prisma.anggotaRef.findMany({
      where: {
        OR: [
          { nama: { contains: q.q, mode: 'insensitive' } },
          { kode: { contains: q.q, mode: 'insensitive' } },
        ],
      },
      take: q.limit,
      orderBy: { nama: 'asc' },
      select: { id: true, kode: true, nama: true, namaKelompok: true, namaDesa: true },
    });
  }

  /** Acara yang boleh diubah user (ADMIN dengan penyelenggara di wilayahnya). */
  async manageable(user: AuthUser, id: string) {
    const scope = await this.scopes.forUser(user);
    const acara = await this.prisma.acara.findFirst({
      where: { id, deletedAt: null },
      include: { pesertaRules: true },
    });
    if (!acara || !canSeeAcara(scope, acara)) throw notFound('Acara', id);
    const owner = { level: acara.penyelenggaraLevel as Level, id: acara.penyelenggaraId };
    if (!canWrite(user) || !canManage(scope, owner)) throw forbiddenScope();
    return { scope, acara };
  }

  private toRules(p: Peserta): Omit<Rule, 'id'>[] {
    return p.wilayah.map((w) => ({
      level: w.level,
      refId: w.id,
      jenisKelamin: p.jenisKelamin ?? null,
      kategori: [...new Set(p.kategori)],
    }));
  }

  /** Tingkat cocok, wilayah dikenal & satu daerah, dan semua wilayah di dalam scope user. */
  private assertPeserta(scope: Scope, p: Peserta, tree: WilayahTree) {
    const err = validateTingkat(p.tingkat, p.wilayah);
    if (err) throw badRequest('PESERTA_INVALID', err);
    const owner = penyelenggara(p.wilayah, tree);
    if (!owner) {
      throw badRequest(
        'WILAYAH_INVALID',
        'Wilayah tidak ditemukan, atau gabungan lintas daerah (belum didukung)',
      );
    }
    if (!p.wilayah.every((w) => canManage(scope, w))) throw forbiddenScope();
    return owner;
  }

  private assertWaktu(mulai: string, selesai: string): void {
    if (new Date(selesai) < new Date(mulai)) {
      throw badRequest('WAKTU_INVALID', 'Tanggal selesai harus setelah tanggal mulai');
    }
  }

  private withNames<T extends AcaraAccess & { tingkat: string }>(
    a: T,
    tree: WilayahTree,
    scope: Scope,
    user: AuthUser,
  ) {
    const first = a.pesertaRules[0];
    return {
      ...a,
      penyelenggaraNama: namaWilayah(tree, a.penyelenggaraLevel, a.penyelenggaraId),
      wilayah: a.pesertaRules.map((r) => ({
        level: r.level,
        id: r.refId,
        nama: namaWilayah(tree, r.level, r.refId),
      })),
      jenisKelamin: first?.jenisKelamin ?? null,
      kategori: first?.kategori ?? [],
      bisaKelola:
        canWrite(user) &&
        canManage(scope, { level: a.penyelenggaraLevel as Level, id: a.penyelenggaraId }),
    };
  }
}
