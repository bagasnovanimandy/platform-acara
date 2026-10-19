import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { forbiddenScope } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManageKelompok, computeScope, type Scope } from './scope.js';

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser): Promise<Scope> {
    if (user.role === 'SUPER_ADMIN')
      return computeScope(true, [], { daerah: [], desa: [], kelompok: [] });
    const [entries, daerah, desa, kelompok] = await Promise.all([
      this.prisma.userScope.findMany({
        where: { userId: user.id },
        select: { level: true, refId: true },
      }),
      this.prisma.daerah.findMany({ select: { id: true } }),
      this.prisma.desa.findMany({ select: { id: true, daerahId: true } }),
      this.prisma.kelompok.findMany({ select: { id: true, desaId: true } }),
    ]);
    return computeScope(false, entries, { daerah, desa, kelompok });
  }

  assertKelompok(scope: Scope, kelompokId: string): void {
    if (!canManageKelompok(scope, kelompokId)) throw forbiddenScope();
  }
}
