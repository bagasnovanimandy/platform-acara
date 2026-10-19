import { Injectable } from '@nestjs/common';
import { diffFields } from '../audit/audit.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { hashPassword } from '../auth/password.js';
import { badRequest, forbiddenScope, notFound } from '../common/app-error.js';
import type { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Scope, type ScopeEntry } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';

const userSelect = {
  id: true,
  nama: true,
  email: true,
  role: true,
  noWa: true,
  anggotaId: true,
  aktif: true,
  lastLoginAt: true,
  createdAt: true,
  scopes: { select: { level: true, refId: true } },
} as const;

/** Scope target harus berada di dalam wilayah yang dikelola pembuatnya (admin bertingkat). */
export function scopesWithin(s: Scope, entries: readonly ScopeEntry[]): boolean {
  if (s.all) return true;
  return entries.every((e) =>
    e.level === 'DAERAH'
      ? s.manageDaerah.has(e.refId)
      : e.level === 'DESA'
        ? s.manageDesa.has(e.refId)
        : s.manageKelompok.has(e.refId),
  );
}

/**
 * SUPER_ADMIN mengelola semua user. ADMIN mengelola user (bukan SUPER_ADMIN) yang seluruh
 * wilayahnya ada di dalam wilayah ADMIN itu, dan hanya bisa memberi wilayah di dalamnya.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    const scope = await this.scopes.forUser(user);
    const rows = await this.prisma.user.findMany({ select: userSelect, orderBy: { nama: 'asc' } });
    return rows.filter((u) => this.manageable(scope, u));
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    const scope = await this.scopes.forUser(user);
    await this.assertAssignable(scope, dto.role, dto.scopes);
    const { password, scopes, ...data } = dto;
    const created = await this.prisma.user.create({
      data: { ...data, passwordHash: await hashPassword(password), scopes: { create: scopes } },
      select: userSelect,
    });
    await this.audit.record(user, {
      aksi: 'CREATE',
      entitas: 'User',
      entitasId: created.id,
      ringkasan: `Menambah pengguna ${created.nama} (${created.role})`,
      data: { email: created.email, role: created.role, wilayah: scopes },
      wilayah: await this.wilayahOf(scopes),
    });
    return created;
  }

  async update(user: AuthUser, id: string, dto: UpdateUserDto) {
    const scope = await this.scopes.forUser(user);
    const current = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!current || !this.manageable(scope, current)) throw notFound('User', id);
    const { password, scopes, ...data } = dto;
    const role = dto.role ?? current.role;
    if (scopes || dto.role) await this.assertAssignable(scope, role, scopes ?? current.scopes);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (scopes) {
        await tx.userScope.deleteMany({ where: { userId: id } });
        await tx.userScope.createMany({ data: scopes.map((s) => ({ ...s, userId: id })) });
      }
      return tx.user.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
        select: userSelect,
      });
    });
    const changes = diffFields(
      { ...current, scopes: current.scopes },
      { ...data, scopes, password: password ? '(diganti)' : undefined },
    );
    if (Object.keys(changes).length > 0) {
      await this.audit.record(user, {
        aksi: 'UPDATE',
        entitas: 'User',
        entitasId: id,
        ringkasan: `Mengubah pengguna ${current.nama}: ${Object.keys(changes).join(', ')}`,
        data: changes,
        wilayah: await this.wilayahOf(updated.scopes),
      });
    }
    return updated;
  }

  private manageable(scope: Scope, u: { role: Role; scopes: ScopeEntry[] }): boolean {
    if (scope.all) return true;
    return u.role !== 'SUPER_ADMIN' && u.scopes.length > 0 && scopesWithin(scope, u.scopes);
  }

  /** Selain SUPER_ADMIN wajib punya wilayah; wilayah harus ada dan di dalam scope pembuat. */
  private async assertAssignable(scope: Scope, role: Role, scopes: ScopeEntry[]): Promise<void> {
    if (role === 'SUPER_ADMIN' && !scope.all) throw forbiddenScope();
    if (role !== 'SUPER_ADMIN' && scopes.length === 0) {
      throw badRequest(
        'SCOPE_REQUIRED',
        'Pengguna selain Super Admin wajib punya minimal satu wilayah',
      );
    }
    for (const s of scopes) {
      const exists =
        s.level === 'DAERAH'
          ? await this.prisma.daerah.count({ where: { id: s.refId } })
          : s.level === 'DESA'
            ? await this.prisma.desa.count({ where: { id: s.refId } })
            : await this.prisma.kelompok.count({ where: { id: s.refId } });
      if (!exists)
        throw badRequest('SCOPE_INVALID', `Wilayah ${s.level} ${s.refId} tidak ditemukan`);
    }
    if (!scopesWithin(scope, scopes)) throw forbiddenScope();
  }

  /** Wilayah untuk entri riwayat: dari wilayah pertama pengguna. */
  private async wilayahOf(scopes: ScopeEntry[]) {
    const s = scopes[0];
    if (!s) return undefined;
    if (s.level === 'KELOMPOK') return this.audit.wilayahKelompok(s.refId);
    if (s.level === 'DESA') {
      const d = await this.prisma.desa.findUnique({ where: { id: s.refId } });
      return d ? { desaId: d.id, daerahId: d.daerahId } : undefined;
    }
    return { daerahId: s.refId };
  }
}
