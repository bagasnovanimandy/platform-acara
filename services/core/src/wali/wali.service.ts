import { Injectable } from '@nestjs/common';
import { AnggotaPublisher } from '../anggota/anggota-publisher.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { forbiddenScope, notFound } from '../common/app-error.js';
import { type Paginated, skipTake } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManageKelompok, kelompokFilter, type Scope } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type { CreateWaliDto, LinkAnakDto, ListWaliQuery, UpdateWaliDto } from './wali.dto.js';

const waliInclude = {
  anak: {
    include: { anggota: { select: { id: true, kode: true, nama: true, kelompokId: true } } },
  },
} satisfies Prisma.WaliInclude;

/** Wali terlihat bila punya minimal satu anak di wilayah user. */
function waliScopeWhere(scope: Scope): Prisma.WaliWhereInput {
  const kf = kelompokFilter(scope);
  return kf ? { anak: { some: { anggota: { kelompokId: kf } } } } : {};
}

@Injectable()
export class WaliService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly publisher: AnggotaPublisher,
  ) {}

  async list(user: AuthUser, q: ListWaliQuery): Promise<Paginated<unknown>> {
    const scope = await this.scopes.forUser(user);
    const where: Prisma.WaliWhereInput = {
      AND: [
        waliScopeWhere(scope),
        q.q
          ? { OR: [{ nama: { contains: q.q, mode: 'insensitive' } }, { noWa: { contains: q.q } }] }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.wali.findMany({
        where,
        include: waliInclude,
        orderBy: { nama: 'asc' },
        ...skipTake(q),
      }),
      this.prisma.wali.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(user: AuthUser, id: string) {
    const scope = await this.scopes.forUser(user);
    const wali = await this.prisma.wali.findFirst({
      where: { id, ...waliScopeWhere(scope) },
      include: waliInclude,
    });
    if (!wali) throw notFound('Wali', id);
    return wali;
  }

  async create(user: AuthUser, dto: CreateWaliDto) {
    const scope = await this.scopes.forUser(user);
    await this.assertAnak(
      scope,
      dto.anak.map((a) => a.anggotaId),
    );
    const wali = await this.prisma.wali.create({
      data: { nama: dto.nama, noWa: dto.noWa, anak: { create: dto.anak } },
      include: waliInclude,
    });
    await this.publisher.publishIds(dto.anak.map((a) => a.anggotaId));
    return wali;
  }

  async update(user: AuthUser, id: string, dto: UpdateWaliDto) {
    const current = await this.get(user, id);
    const wali = await this.prisma.wali.update({ where: { id }, data: dto, include: waliInclude });
    if (dto.noWa && dto.noWa !== current.noWa) {
      await this.publisher.publishIds(wali.anak.map((a) => a.anggotaId));
    }
    return wali;
  }

  /** Tautkan wali ke anak. Wali boleh dari luar wilayah (mis. orang tua pindahan) asal anaknya di wilayah user. */
  async linkAnak(user: AuthUser, id: string, dto: LinkAnakDto) {
    const scope = await this.scopes.forUser(user);
    await this.assertAnak(scope, [dto.anggotaId]);
    if (!(await this.prisma.wali.findUnique({ where: { id }, select: { id: true } })))
      throw notFound('Wali', id);
    await this.prisma.anggotaWali.upsert({
      where: { anggotaId_waliId: { anggotaId: dto.anggotaId, waliId: id } },
      create: { anggotaId: dto.anggotaId, waliId: id, hubungan: dto.hubungan },
      update: { hubungan: dto.hubungan },
    });
    await this.publisher.publishIds([dto.anggotaId]);
    return this.prisma.wali.findUniqueOrThrow({ where: { id }, include: waliInclude });
  }

  private async assertAnak(scope: Scope, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const anak = await this.prisma.anggota.findMany({
      where: { id: { in: ids } },
      select: { id: true, kelompokId: true },
    });
    if (anak.length !== new Set(ids).size) throw notFound('Anggota');
    if (anak.some((a) => !canManageKelompok(scope, a.kelompokId))) throw forbiddenScope();
  }
}
