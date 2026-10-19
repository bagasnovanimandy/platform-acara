import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { type Paginated, skipTake } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../scope/scope.service.js';
import { auditScopeWhere } from './audit.js';
import type { ListAuditQuery } from './audit.dto.js';

export interface AuditEntry {
  aksi: string;
  entitas: string;
  entitasId?: string | null;
  ringkasan: string;
  data?: Prisma.InputJsonValue;
  wilayah?: { daerahId?: string | null; desaId?: string | null; kelompokId?: string | null };
}

type Db = Pick<Prisma.TransactionClient, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
  ) {}

  /** Catat perubahan. Berikan `tx` agar ikut transaksi yang sama dengan perubahannya. */
  async record(user: AuthUser, entries: AuditEntry | AuditEntry[], tx: Db = this.prisma) {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;
    await tx.auditLog.createMany({
      data: list.map((e) => ({
        userId: user.id,
        userNama: user.nama,
        aksi: e.aksi,
        entitas: e.entitas,
        entitasId: e.entitasId ?? null,
        ringkasan: e.ringkasan,
        data: e.data,
        daerahId: e.wilayah?.daerahId ?? null,
        desaId: e.wilayah?.desaId ?? null,
        kelompokId: e.wilayah?.kelompokId ?? null,
      })),
    });
  }

  /** Wilayah lengkap dari kelompokId (untuk entri yang menyangkut anggota). */
  async wilayahKelompok(kelompokId: string) {
    const k = await this.prisma.kelompok.findUnique({
      where: { id: kelompokId },
      select: { id: true, desaId: true, desa: { select: { daerahId: true } } },
    });
    return k ? { kelompokId: k.id, desaId: k.desaId, daerahId: k.desa.daerahId } : {};
  }

  async list(user: AuthUser, q: ListAuditQuery): Promise<Paginated<unknown>> {
    const scope = await this.scopes.forUser(user);
    const and: Prisma.AuditLogWhereInput[] = [];
    const sw = auditScopeWhere(scope);
    if (sw) and.push(sw);
    if (q.entitas) and.push({ entitas: q.entitas });
    if (q.entitasId) and.push({ entitasId: q.entitasId });
    if (q.userId) and.push({ userId: q.userId });
    if (q.aksi) and.push({ aksi: q.aksi });
    if (q.dari) and.push({ createdAt: { gte: new Date(q.dari) } });
    if (q.sampai) and.push({ createdAt: { lte: new Date(q.sampai) } });
    if (q.q) and.push({ ringkasan: { contains: q.q, mode: 'insensitive' } });
    const where = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
