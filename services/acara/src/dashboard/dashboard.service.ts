import { Injectable } from '@nestjs/common';
import { canSeeAcara } from '../acara/acara.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../scope/scope.service.js';
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
}
