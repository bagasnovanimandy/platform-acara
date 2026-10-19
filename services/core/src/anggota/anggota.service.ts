import { Injectable } from '@nestjs/common';
import { EVENTS, normalizeWa } from '@platform-acara/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { badRequest, notFound } from '../common/app-error.js';
import { fromIsoDate } from '../common/dates.js';
import { type Paginated, skipTake } from '../common/pagination.js';
import { EventsService } from '../events/events.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManageKelompok, kelompokFilter, type Scope } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import { AnggotaPublisher } from './anggota-publisher.service.js';
import type {
  CreateAnggotaDto,
  ListAnggotaQuery,
  MutasiDto,
  UpdateAnggotaDto,
} from './anggota.dto.js';
import {
  type ImportContext,
  type RawRow,
  type RowError,
  type ValidRow,
  validateImportRows,
  type WilayahRef,
  wilayahKey,
} from './import.js';
import { formatKodeAnggota, nextUrut } from './kode.js';

const listInclude = {
  kelompok: {
    select: {
      id: true,
      nama: true,
      desa: { select: { id: true, nama: true, daerah: { select: { id: true, nama: true } } } },
    },
  },
} satisfies Prisma.AnggotaInclude;

export interface ImportResult {
  dryRun: boolean;
  total: number;
  valid: number;
  gagal: number;
  dibuat: number;
  errors: RowError[];
  preview: (Omit<ValidRow, 'wilayah'> & { kelompok: string; desa: string; daerah: string })[];
}

@Injectable()
export class AnggotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly publisher: AnggotaPublisher,
    private readonly events: EventsService,
  ) {}

  async list(user: AuthUser, q: ListAnggotaQuery): Promise<Paginated<unknown>> {
    const scope = await this.scopes.forUser(user);
    const and: Prisma.AnggotaWhereInput[] = [];
    const kf = kelompokFilter(scope);
    if (kf) and.push({ kelompokId: kf });
    if (q.kelompokId) and.push({ kelompokId: q.kelompokId });
    if (q.desaId) and.push({ kelompok: { desaId: q.desaId } });
    if (q.daerahId) and.push({ kelompok: { desa: { daerahId: q.daerahId } } });
    if (q.status) and.push({ status: q.status });
    if (q.jenisKelamin) and.push({ jenisKelamin: q.jenisKelamin });
    if (q.kategori) and.push({ kategori: q.kategori === 'BELUM' ? null : q.kategori });
    if (q.q) {
      and.push({
        OR: [
          { nama: { contains: q.q, mode: 'insensitive' } },
          { kode: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.AnggotaWhereInput = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.anggota.findMany({
        where,
        include: listInclude,
        orderBy: [{ nama: 'asc' }, { kode: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.anggota.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(user: AuthUser, id: string) {
    const scope = await this.scopes.forUser(user);
    const a = await this.prisma.anggota.findUnique({
      where: { id },
      include: {
        ...listInclude,
        wali: { include: { wali: true } },
        mutasi: { orderBy: { tanggal: 'desc' } },
      },
    });
    if (!a || !canManageKelompok(scope, a.kelompokId)) throw notFound('Anggota', id);
    return a;
  }

  async create(user: AuthUser, dto: CreateAnggotaDto) {
    const scope = await this.scopes.forUser(user);
    const kelompok = await this.kelompokOrThrow(dto.kelompokId);
    this.scopes.assertKelompok(scope, kelompok.id);
    const created = await this.prisma.$transaction(async (tx) => {
      const kode = formatKodeAnggota(kelompok.desa.kode, await nextUrut(tx, kelompok.desaId));
      return tx.anggota.create({
        data: {
          kode,
          nama: dto.nama,
          jenisKelamin: dto.jenisKelamin,
          tanggalLahir: dto.tanggalLahir ? fromIsoDate(dto.tanggalLahir) : null,
          kategori: dto.kategori ?? null,
          noWa: dto.noWa,
          status: dto.status,
          fotoUrl: dto.fotoUrl,
          kelompokId: kelompok.id,
        },
      });
    });
    await this.publisher.publishIds([created.id]);
    return created;
  }

  async update(user: AuthUser, id: string, dto: UpdateAnggotaDto) {
    await this.get(user, id);
    const updated = await this.prisma.anggota.update({
      where: { id },
      data: {
        ...dto,
        tanggalLahir:
          dto.tanggalLahir === undefined
            ? undefined
            : dto.tanggalLahir
              ? fromIsoDate(dto.tanggalLahir)
              : null,
      },
    });
    await this.publisher.publishIds([id]);
    return updated;
  }

  /** Pindah kelompok. Asal harus dalam scope; tujuan boleh kelompok mana saja (pindah sambung keluar). */
  async mutasi(user: AuthUser, id: string, dto: MutasiDto) {
    const anggota = await this.get(user, id);
    if (anggota.kelompokId === dto.keKelompokId) {
      throw badRequest('SAME_KELOMPOK', 'Kelompok tujuan sama dengan kelompok sekarang');
    }
    await this.kelompokOrThrow(dto.keKelompokId);
    const tanggal = fromIsoDate(dto.tanggal);
    const result = await this.prisma.$transaction(async (tx) => {
      const mutasi = await tx.mutasiSambung.create({
        data: {
          anggotaId: id,
          dariKelompokId: anggota.kelompokId,
          keKelompokId: dto.keKelompokId,
          tanggal,
          catatan: dto.catatan,
          dicatatOleh: user.id,
        },
      });
      await tx.anggota.update({ where: { id }, data: { kelompokId: dto.keKelompokId } });
      return mutasi;
    });
    await this.events.publish(EVENTS.ANGGOTA_MUTASI, {
      anggotaId: id,
      dariKelompokId: anggota.kelompokId,
      keKelompokId: dto.keKelompokId,
      tanggal: dto.tanggal,
    });
    await this.publisher.publishIds([id]);
    return result;
  }

  async import(
    user: AuthUser,
    rows: RawRow[],
    firstRow: number,
    dryRun: boolean,
  ): Promise<ImportResult> {
    const scope = await this.scopes.forUser(user);
    const ctx = await this.importContext(scope, rows);
    const { valid, errors } = validateImportRows(rows, ctx, firstRow);
    const result: ImportResult = {
      dryRun,
      total: rows.length,
      valid: valid.length,
      gagal: errors.length,
      dibuat: 0,
      errors,
      preview: valid.slice(0, 50).map(({ wilayah, ...r }) => ({
        ...r,
        kelompok: wilayah.kelompok,
        desa: wilayah.desa,
        daerah: wilayah.daerah,
      })),
    };
    if (dryRun || valid.length === 0) return result;

    // Baris valid dibuat dalam satu transaksi: semua masuk atau tidak sama sekali.
    const ids = await this.prisma.$transaction(
      async (tx) => {
        const created: string[] = [];
        for (const row of valid) {
          const kode = formatKodeAnggota(
            row.wilayah.kodeDesa,
            await nextUrut(tx, row.wilayah.desaId),
          );
          const a = await tx.anggota.create({
            data: {
              kode,
              nama: row.nama,
              jenisKelamin: row.jenisKelamin,
              tanggalLahir: row.tanggalLahir ? fromIsoDate(row.tanggalLahir) : null,
              kategori: row.kategori,
              noWa: row.noWa,
              kelompokId: row.wilayah.kelompokId,
            },
          });
          if (row.noWaOrtu) {
            const wali = await tx.wali.upsert({
              where: { noWa: row.noWaOrtu },
              create: { noWa: row.noWaOrtu, nama: row.namaOrtu ?? `Wali ${row.nama}` },
              update: {},
            });
            await tx.anggotaWali.create({
              data: { anggotaId: a.id, waliId: wali.id, hubungan: 'WALI' },
            });
          }
          created.push(a.id);
        }
        return created;
      },
      { timeout: 60_000 },
    );
    result.dibuat = ids.length;
    await this.publisher.publishIds(ids);
    return result;
  }

  private async importContext(scope: Scope, rows: RawRow[]): Promise<ImportContext> {
    const kelompok = await this.prisma.kelompok.findMany({
      include: { desa: { include: { daerah: true } } },
    });
    const wilayah = new Map<string, WilayahRef>();
    for (const k of kelompok) {
      wilayah.set(wilayahKey(k.desa.daerah.nama, k.desa.nama, k.nama), {
        kelompokId: k.id,
        kelompok: k.nama,
        desaId: k.desaId,
        desa: k.desa.nama,
        kodeDesa: k.desa.kode,
        daerah: k.desa.daerah.nama,
      });
    }
    const candidates = rows
      .map((r) => (r['No WA'] == null ? null : normalizeWa(String(r['No WA']))))
      .filter((v): v is string => v !== null);
    const existing = candidates.length
      ? await this.prisma.anggota.findMany({
          where: { noWa: { in: candidates } },
          select: { noWa: true },
        })
      : [];
    return {
      wilayah,
      canManageKelompok: (id) => canManageKelompok(scope, id),
      existingNoWa: new Set(existing.map((e) => e.noWa).filter((v): v is string => v !== null)),
    };
  }

  private async kelompokOrThrow(id: string) {
    const k = await this.prisma.kelompok.findUnique({ where: { id }, include: { desa: true } });
    if (!k) throw notFound('Kelompok', id);
    return k;
  }
}
