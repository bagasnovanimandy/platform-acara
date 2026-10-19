import { Injectable } from '@nestjs/common';
import { hashPassword } from '../auth/password.js';
import { badRequest, notFound } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
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

type ScopeInput = CreateUserDto['scopes'];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { nama: 'asc' } });
  }

  async create(dto: CreateUserDto) {
    await this.assertScopes(dto.role, dto.scopes);
    const { password, scopes, ...data } = dto;
    return this.prisma.user.create({
      data: { ...data, passwordHash: await hashPassword(password), scopes: { create: scopes } },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!current) throw notFound('User', id);
    const { password, scopes, ...data } = dto;
    if (scopes) await this.assertScopes(dto.role ?? current.role, scopes);
    return this.prisma.$transaction(async (tx) => {
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
  }

  /** ADMIN/PENGURUS wajib punya scope, dan refId harus ada di tabel wilayah sesuai level. */
  private async assertScopes(role: string, scopes: ScopeInput): Promise<void> {
    if (role !== 'SUPER_ADMIN' && scopes.length === 0) {
      throw badRequest('SCOPE_REQUIRED', 'ADMIN dan PENGURUS wajib punya minimal satu wilayah');
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
  }
}
