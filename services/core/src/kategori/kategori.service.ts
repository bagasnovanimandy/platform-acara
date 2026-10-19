import { Injectable } from '@nestjs/common';
import { kodeKategori } from '@platform-acara/shared';
import { diffFields } from '../audit/audit.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { badRequest, conflict, forbiddenScope, notFound } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kelompokFilter, type Scope } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type { CreateKategoriDto, UpdateKategoriDto } from './kategori.dto.js';

/** Daftar kategori berlaku lintas wilayah, jadi hanya SUPER_ADMIN dan admin daerah yang mengubahnya. */
const canManageKategori = (s: Scope): boolean => s.all || s.manageDaerah.size > 0;

@Injectable()
export class KategoriService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Semua kategori + jumlah anggota (dalam scope user) per kategori. */
  async list(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const kf = kelompokFilter(scope);
    const [rows, counts] = await Promise.all([
      this.prisma.kategori.findMany({ orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] }),
      this.prisma.anggotaKategori.groupBy({
        by: ['kategoriId'],
        where: kf ? { anggota: { kelompokId: kf } } : {},
        _count: { _all: true },
      }),
    ]);
    const byId = new Map(counts.map((c) => [c.kategoriId, c._count._all]));
    return {
      bisaKelola: canManageKategori(scope),
      items: rows.map((k) => ({ ...k, jumlahAnggota: byId.get(k.id) ?? 0 })),
    };
  }

  async create(user: AuthUser, dto: CreateKategoriDto) {
    await this.assertManage(user);
    const kode = kodeKategori(dto.nama);
    if (!kode) throw badRequest('NAMA_INVALID', 'Nama kategori harus mengandung huruf atau angka');
    if (await this.prisma.kategori.count({ where: { kode } })) {
      throw conflict('DUPLICATE', `Kategori dengan kode ${kode} sudah ada`);
    }
    const urutan =
      dto.urutan ??
      ((await this.prisma.kategori.aggregate({ _max: { urutan: true } }))._max.urutan ?? 0) + 10;
    const row = await this.prisma.kategori.create({ data: { ...dto, kode, urutan } });
    await this.audit.record(user, {
      aksi: 'CREATE',
      entitas: 'Kategori',
      entitasId: row.id,
      ringkasan: `Menambah kategori ${row.nama}`,
    });
    return row;
  }

  async update(user: AuthUser, id: string, dto: UpdateKategoriDto) {
    await this.assertManage(user);
    const before = await this.prisma.kategori.findUnique({ where: { id } });
    if (!before) throw notFound('Kategori', id);
    const row = await this.prisma.kategori.update({ where: { id }, data: dto });
    const changes = diffFields(before, dto);
    if (Object.keys(changes).length > 0) {
      await this.audit.record(user, {
        aksi: 'UPDATE',
        entitas: 'Kategori',
        entitasId: id,
        ringkasan: `Mengubah kategori ${before.nama}`,
        data: changes,
      });
    }
    return row;
  }

  private async assertManage(user: AuthUser): Promise<void> {
    if (!canManageKategori(await this.scopes.forUser(user))) throw forbiddenScope();
  }
}
