import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { forbiddenScope, notFound } from '../common/app-error.js';
import { AnggotaPublisher } from '../anggota/anggota-publisher.service.js';
import { diffFields } from '../audit/audit.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  canManageDaerah,
  canManageDesa,
  canManageKelompok,
  canSeeDaerah,
  canSeeDesa,
} from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type {
  CreateDaerahDto,
  CreateDesaDto,
  CreateKelompokDto,
  UpdateDaerahDto,
  UpdateDesaDto,
  UpdateKelompokDto,
} from './wilayah.dto.js';

@Injectable()
export class WilayahService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly publisher: AnggotaPublisher,
    private readonly audit: AuditService,
  ) {}

  /** Pohon wilayah yang terlihat oleh user, untuk pilihan bertingkat di web. */
  async tree(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const daerah = await this.prisma.daerah.findMany({
      orderBy: { nama: 'asc' },
      include: {
        desa: {
          orderBy: { nama: 'asc' },
          include: { kelompok: { orderBy: { nama: 'asc' } } },
        },
      },
    });
    return daerah
      .filter((d) => canSeeDaerah(scope, d.id))
      .map((d) => ({
        ...d,
        bisaKelola: canManageDaerah(scope, d.id),
        desa: d.desa
          .filter((s) => canSeeDesa(scope, s.id))
          .map((s) => ({
            ...s,
            bisaKelola: canManageDesa(scope, s.id),
            kelompok: s.kelompok.filter((k) => canManageKelompok(scope, k.id)),
          })),
      }));
  }

  async listDaerah(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const rows = await this.prisma.daerah.findMany({ orderBy: { nama: 'asc' } });
    return rows.filter((d) => canSeeDaerah(scope, d.id));
  }

  async listDesa(user: AuthUser, daerahId?: string) {
    const scope = await this.scopes.forUser(user);
    const rows = await this.prisma.desa.findMany({ where: { daerahId }, orderBy: { nama: 'asc' } });
    return rows.filter((d) => canSeeDesa(scope, d.id));
  }

  async listKelompok(user: AuthUser, desaId?: string) {
    const scope = await this.scopes.forUser(user);
    const rows = await this.prisma.kelompok.findMany({
      where: { desaId },
      orderBy: { nama: 'asc' },
    });
    return rows.filter((k) => canManageKelompok(scope, k.id));
  }

  /** Hanya SUPER_ADMIN (dicek di controller). */
  async createDaerah(user: AuthUser, dto: CreateDaerahDto) {
    const row = await this.prisma.daerah.create({ data: dto });
    await this.audit.record(user, {
      aksi: 'CREATE',
      entitas: 'Daerah',
      entitasId: row.id,
      ringkasan: `Menambah daerah ${row.nama}`,
      wilayah: { daerahId: row.id },
    });
    return row;
  }

  async updateDaerah(user: AuthUser, id: string, dto: UpdateDaerahDto) {
    const scope = await this.scopes.forUser(user);
    await this.mustExist('daerah', id);
    if (!canManageDaerah(scope, id)) throw forbiddenScope();
    const before = await this.prisma.daerah.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.daerah.update({ where: { id }, data: dto });
    await this.recordUpdate(user, 'Daerah', before, dto, { daerahId: id });
    if (dto.nama) await this.publisher.publishWhere({ kelompok: { desa: { daerahId: id } } });
    return row;
  }

  async createDesa(user: AuthUser, dto: CreateDesaDto) {
    const scope = await this.scopes.forUser(user);
    await this.mustExist('daerah', dto.daerahId);
    if (!canManageDaerah(scope, dto.daerahId)) throw forbiddenScope();
    const row = await this.prisma.desa.create({ data: dto });
    await this.audit.record(user, {
      aksi: 'CREATE',
      entitas: 'Desa',
      entitasId: row.id,
      ringkasan: `Menambah desa ${row.nama}`,
      wilayah: { daerahId: row.daerahId, desaId: row.id },
    });
    return row;
  }

  async updateDesa(user: AuthUser, id: string, dto: UpdateDesaDto) {
    const scope = await this.scopes.forUser(user);
    await this.mustExist('desa', id);
    if (!canManageDesa(scope, id)) throw forbiddenScope();
    const before = await this.prisma.desa.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.desa.update({ where: { id }, data: dto });
    await this.recordUpdate(user, 'Desa', before, dto, { daerahId: row.daerahId, desaId: id });
    if (dto.nama) await this.publisher.publishWhere({ kelompok: { desaId: id } });
    return row;
  }

  async createKelompok(user: AuthUser, dto: CreateKelompokDto) {
    const scope = await this.scopes.forUser(user);
    await this.mustExist('desa', dto.desaId);
    if (!canManageDesa(scope, dto.desaId)) throw forbiddenScope();
    const row = await this.prisma.kelompok.create({ data: dto, include: { desa: true } });
    await this.audit.record(user, {
      aksi: 'CREATE',
      entitas: 'Kelompok',
      entitasId: row.id,
      ringkasan: `Menambah kelompok ${row.nama}`,
      wilayah: { daerahId: row.desa.daerahId, desaId: row.desaId, kelompokId: row.id },
    });
    return row;
  }

  async updateKelompok(user: AuthUser, id: string, dto: UpdateKelompokDto) {
    const scope = await this.scopes.forUser(user);
    await this.mustExist('kelompok', id);
    if (!canManageKelompok(scope, id)) throw forbiddenScope();
    const before = await this.prisma.kelompok.findUniqueOrThrow({
      where: { id },
      include: { desa: true },
    });
    const row = await this.prisma.kelompok.update({ where: { id }, data: dto });
    await this.recordUpdate(user, 'Kelompok', before, dto, {
      daerahId: before.desa.daerahId,
      desaId: before.desaId,
      kelompokId: id,
    });
    if (dto.nama) await this.publisher.publishWhere({ kelompokId: id });
    return row;
  }

  private async recordUpdate(
    user: AuthUser,
    entitas: string,
    before: { id: string; nama: string },
    dto: object,
    wilayah: { daerahId?: string; desaId?: string; kelompokId?: string },
  ): Promise<void> {
    const changes = diffFields(before, dto);
    if (Object.keys(changes).length === 0) return;
    await this.audit.record(user, {
      aksi: 'UPDATE',
      entitas,
      entitasId: before.id,
      ringkasan: `Mengubah ${entitas.toLowerCase()} ${before.nama}`,
      data: changes,
      wilayah,
    });
  }

  private async mustExist(level: 'daerah' | 'desa' | 'kelompok', id: string): Promise<void> {
    const found =
      level === 'daerah'
        ? await this.prisma.daerah.findUnique({ where: { id }, select: { id: true } })
        : level === 'desa'
          ? await this.prisma.desa.findUnique({ where: { id }, select: { id: true } })
          : await this.prisma.kelompok.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw notFound(level[0]!.toUpperCase() + level.slice(1), id);
  }
}
