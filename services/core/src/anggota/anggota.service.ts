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
import { diffFields } from '../audit/audit.js';
import { AuditService } from '../audit/audit.service.js';
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
  kategori: {
    select: { kategori: { select: { id: true, kode: true, nama: true, warna: true } } },
    orderBy: { kategori: { urutan: 'asc' } },
  },
} satisfies Prisma.AnggotaInclude;

type KategoriRef = { id: string; kode: string; nama: string; warna: string };

/** `kategori: [{kategori: {...}}]` (bentuk relasi) → `kategori: [{...}]`. */
function flatKategori<T extends { kategori: { kategori: KategoriRef }[] }>(
  a: T,
): Omit<T, 'kategori'> & { kategori: KategoriRef[] } {
  return { ...a, kategori: a.kategori.map((k) => k.kategori) };
}

const wilayahOf = (k: { id: string; desaId: string; desa: { daerahId: string } }) => ({
  kelompokId: k.id,
  desaId: k.desaId,
  daerahId: k.desa.daerahId,
});

export interface ImportResult {
  dryRun: boolean;
  total: number;
  valid: number;
  gagal: number;
  dibuat: number;
  errors: RowError[];
  preview: (Omit<ValidRow, 'wilayah' | 'kategoriIds'> & {
    kategori: KategoriRef[];
    kelompok: string;
    desa: string;
    daerah: string;
  })[];
}

@Injectable()
export class AnggotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly publisher: AnggotaPublisher,
    private readonly events: EventsService,
    private readonly audit: AuditService,
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
    if (q.kategoriId === 'BELUM') and.push({ kategori: { none: {} } });
    else if (q.kategoriId) and.push({ kategori: { some: { kategoriId: q.kategoriId } } });
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
    return { items: items.map(flatKategori), total, page: q.page, pageSize: q.pageSize };
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
    return flatKategori(a);
  }

  /** Riwayat perubahan satu anggota (dari AuditLog), terbaru dulu. */
  async riwayat(user: AuthUser, id: string) {
    await this.get(user, id);
    return this.prisma.auditLog.findMany({
      where: { entitas: 'Anggota', entitasId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(user: AuthUser, dto: CreateAnggotaDto) {
    const scope = await this.scopes.forUser(user);
    const kelompok = await this.kelompokOrThrow(dto.kelompokId);
    this.scopes.assertKelompok(scope, kelompok.id);
    const kategori = await this.kategoriOrThrow(dto.kategoriIds);
    const created = await this.prisma.$transaction(async (tx) => {
      const kode = formatKodeAnggota(kelompok.desa.kode, await nextUrut(tx, kelompok.desaId));
      const a = await tx.anggota.create({
        data: {
          kode,
          nama: dto.nama,
          jenisKelamin: dto.jenisKelamin,
          tanggalLahir: dto.tanggalLahir ? fromIsoDate(dto.tanggalLahir) : null,
          noWa: dto.noWa,
          status: dto.status,
          fotoUrl: dto.fotoUrl,
          kelompokId: kelompok.id,
          kategori: { create: kategori.map((k) => ({ kategoriId: k.id })) },
        },
      });
      await this.audit.record(
        user,
        {
          aksi: 'CREATE',
          entitas: 'Anggota',
          entitasId: a.id,
          ringkasan: `Menambah anggota ${a.kode} ${a.nama}`,
          data: { kelompok: kelompok.nama, kategori: kategori.map((k) => k.nama) },
          wilayah: wilayahOf(kelompok),
        },
        tx,
      );
      return a;
    });
    await this.publisher.publishIds([created.id]);
    return this.get(user, created.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateAnggotaDto) {
    const before = await this.get(user, id);
    const { kategoriIds, ...fields } = dto;
    const kategori = kategoriIds ? await this.kategoriOrThrow(kategoriIds) : undefined;
    const data = {
      ...fields,
      updatedAt: new Date(), // kategori ada di tabel lain; tetap tandai berubah untuk resync
      tanggalLahir:
        fields.tanggalLahir === undefined
          ? undefined
          : fields.tanggalLahir
            ? fromIsoDate(fields.tanggalLahir)
            : null,
    };
    const changes = diffFields(
      { ...before, kategori: before.kategori.map((k) => k.nama).sort() },
      { ...data, updatedAt: undefined, kategori: kategori?.map((k) => k.nama).sort() },
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.anggota.update({ where: { id }, data });
      if (kategori) {
        await tx.anggotaKategori.deleteMany({ where: { anggotaId: id } });
        await tx.anggotaKategori.createMany({
          data: kategori.map((k) => ({ anggotaId: id, kategoriId: k.id })),
        });
      }
      if (Object.keys(changes).length > 0) {
        await this.audit.record(
          user,
          {
            aksi: 'UPDATE',
            entitas: 'Anggota',
            entitasId: id,
            ringkasan: `Mengubah ${Object.keys(changes).join(', ')}`,
            data: changes,
            wilayah: {
              kelompokId: before.kelompok.id,
              desaId: before.kelompok.desa.id,
              daerahId: before.kelompok.desa.daerah.id,
            },
          },
          tx,
        );
      }
    });
    await this.publisher.publishIds([id]);
    return this.get(user, id);
  }

  /** Pindah kelompok. Asal harus dalam scope; tujuan boleh kelompok mana saja (pindah sambung keluar). */
  async mutasi(user: AuthUser, id: string, dto: MutasiDto) {
    const anggota = await this.get(user, id);
    if (anggota.kelompokId === dto.keKelompokId) {
      throw badRequest('SAME_KELOMPOK', 'Kelompok tujuan sama dengan kelompok sekarang');
    }
    const tujuan = await this.kelompokOrThrow(dto.keKelompokId);
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
      const ringkasan = `Pindah dari ${anggota.kelompok.nama} ke ${tujuan.nama}`;
      // Dicatat di wilayah asal dan tujuan agar terlihat oleh auditor keduanya.
      await this.audit.record(
        user,
        [
          {
            aksi: 'MUTASI',
            entitas: 'Anggota',
            entitasId: id,
            ringkasan,
            data: { tanggal: dto.tanggal, catatan: dto.catatan ?? null },
            wilayah: {
              kelompokId: anggota.kelompok.id,
              desaId: anggota.kelompok.desa.id,
              daerahId: anggota.kelompok.desa.daerah.id,
            },
          },
          {
            aksi: 'MUTASI_MASUK',
            entitas: 'Kelompok',
            entitasId: tujuan.id,
            ringkasan: `${anggota.kode} ${anggota.nama}: ${ringkasan}`,
            wilayah: wilayahOf(tujuan),
          },
        ],
        tx,
      );
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
      preview: valid.slice(0, 50).map(({ wilayah, kategoriIds, ...r }) => ({
        ...r,
        kategori: kategoriIds.map((id) => ctx.kategori.get(id)!),
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
              noWa: row.noWa,
              kelompokId: row.wilayah.kelompokId,
              kategori: { create: row.kategoriIds.map((kategoriId) => ({ kategoriId })) },
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
        await this.audit.record(
          user,
          valid.map((row, i) => ({
            aksi: 'IMPORT',
            entitas: 'Anggota',
            entitasId: created[i],
            ringkasan: `Ditambahkan lewat import Excel (baris ${row.baris})`,
            wilayah: {
              kelompokId: row.wilayah.kelompokId,
              desaId: row.wilayah.desaId,
              daerahId: row.wilayah.daerahId,
            },
          })),
          tx,
        );
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
        daerahId: k.desa.daerahId,
        daerah: k.desa.daerah.nama,
      });
    }
    const kategori = await this.prisma.kategori.findMany({
      where: { aktif: true },
      select: { id: true, kode: true, nama: true, warna: true },
    });
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
      kategori: new Map(kategori.map((k) => [k.id, k])),
    };
  }

  private async kelompokOrThrow(id: string) {
    const k = await this.prisma.kelompok.findUnique({ where: { id }, include: { desa: true } });
    if (!k) throw notFound('Kelompok', id);
    return k;
  }

  async namaKategoriAktif(): Promise<string[]> {
    const rows = await this.prisma.kategori.findMany({
      where: { aktif: true },
      orderBy: { urutan: 'asc' },
      select: { nama: true },
    });
    return rows.map((r) => r.nama);
  }

  /** Kategori harus ada dan aktif. */
  private async kategoriOrThrow(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const rows = await this.prisma.kategori.findMany({
      where: { id: { in: unique }, aktif: true },
      orderBy: { urutan: 'asc' },
    });
    if (rows.length !== unique.length) {
      throw badRequest('KATEGORI_INVALID', 'Kategori tidak ditemukan atau sudah nonaktif');
    }
    return rows;
  }
}
