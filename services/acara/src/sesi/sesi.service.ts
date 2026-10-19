import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AcaraService } from '../acara/acara.service.js';
import { badRequest, notFound } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateRundownDto,
  CreateSesiDto,
  UpdateRundownDto,
  UpdateSesiDto,
  UrutanDto,
} from './sesi.dto.js';

const toDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);

function assertRentang(mulai: Date | null | undefined, selesai: Date | null | undefined): void {
  if (mulai && selesai && selesai < mulai) {
    throw badRequest('WAKTU_INVALID', 'Waktu selesai harus setelah waktu mulai');
  }
}

@Injectable()
export class SesiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraService,
  ) {}

  async create(user: AuthUser, acaraId: string, dto: CreateSesiDto) {
    await this.acara.manageable(user, acaraId);
    const mulai = new Date(dto.mulai);
    const selesai = new Date(dto.selesai);
    assertRentang(mulai, selesai);
    await this.prisma.sesi.create({
      data: {
        acaraId,
        nama: dto.nama,
        mulai,
        selesai,
        toleransiMenit: dto.toleransiMenit,
        batasIzin: toDate(dto.batasIzin) ?? mulai,
      },
    });
    return this.acara.get(user, acaraId);
  }

  async update(user: AuthUser, id: string, dto: UpdateSesiDto) {
    const sesi = await this.sesiManageable(user, id);
    const mulai = toDate(dto.mulai) ?? sesi.mulai;
    const selesai = toDate(dto.selesai) ?? sesi.selesai;
    assertRentang(mulai, selesai);
    await this.prisma.sesi.update({
      where: { id },
      data: {
        nama: dto.nama,
        mulai: dto.mulai ? mulai : undefined,
        selesai: dto.selesai ? selesai : undefined,
        toleransiMenit: dto.toleransiMenit,
        batasIzin: toDate(dto.batasIzin),
      },
    });
    return this.acara.get(user, sesi.acaraId);
  }

  async remove(user: AuthUser, id: string) {
    const sesi = await this.sesiManageable(user, id);
    await this.prisma.sesi.update({ where: { id }, data: { deletedAt: new Date() } });
    return this.acara.get(user, sesi.acaraId);
  }

  async addRundown(user: AuthUser, sesiId: string, dto: CreateRundownDto) {
    const sesi = await this.sesiManageable(user, sesiId);
    const mulai = toDate(dto.mulai);
    const selesai = toDate(dto.selesai);
    assertRentang(mulai, selesai);
    await this.assertPengisi(dto.pengisi);
    const last = await this.prisma.rundownItem.aggregate({
      where: { sesiId },
      _max: { urutan: true },
    });
    await this.prisma.rundownItem.create({
      data: {
        sesiId,
        urutan: (last._max.urutan ?? 0) + 1,
        judul: dto.judul,
        keterangan: dto.keterangan,
        mulai,
        selesai,
        pengisi: { create: dto.pengisi.map(pengisiData) },
      },
    });
    return this.acara.get(user, sesi.acaraId);
  }

  async updateRundown(user: AuthUser, id: string, dto: UpdateRundownDto) {
    const item = await this.prisma.rundownItem.findUnique({ where: { id } });
    if (!item) throw notFound('Rundown', id);
    const sesi = await this.sesiManageable(user, item.sesiId);
    const mulai = dto.mulai === undefined ? item.mulai : toDate(dto.mulai);
    const selesai = dto.selesai === undefined ? item.selesai : toDate(dto.selesai);
    assertRentang(mulai, selesai);
    if (dto.pengisi) await this.assertPengisi(dto.pengisi);
    await this.prisma.rundownItem.update({
      where: { id },
      data: {
        judul: dto.judul,
        keterangan: dto.keterangan,
        mulai: toDate(dto.mulai),
        selesai: toDate(dto.selesai),
        ...(dto.pengisi && {
          pengisi: { deleteMany: {}, create: dto.pengisi.map(pengisiData) },
        }),
      },
    });
    return this.acara.get(user, sesi.acaraId);
  }

  /** Rundown bukan data inti; dihapus permanen bersama pengisinya. */
  async removeRundown(user: AuthUser, id: string) {
    const item = await this.prisma.rundownItem.findUnique({ where: { id } });
    if (!item) throw notFound('Rundown', id);
    const sesi = await this.sesiManageable(user, item.sesiId);
    await this.prisma.$transaction([
      this.prisma.pengisi.deleteMany({ where: { rundownItemId: id } }),
      this.prisma.rundownItem.delete({ where: { id } }),
    ]);
    return this.acara.get(user, sesi.acaraId);
  }

  /** Simpan urutan baru hasil geser (drag). `ids` harus berisi semua item sesi. */
  async reorder(user: AuthUser, sesiId: string, dto: UrutanDto) {
    const sesi = await this.sesiManageable(user, sesiId);
    const items = await this.prisma.rundownItem.findMany({
      where: { sesiId },
      select: { id: true },
    });
    const existing = new Set(items.map((i) => i.id));
    if (
      dto.ids.length !== existing.size ||
      new Set(dto.ids).size !== dto.ids.length ||
      !dto.ids.every((i) => existing.has(i))
    ) {
      throw badRequest('URUTAN_INVALID', 'Daftar urutan harus berisi semua item rundown sesi ini');
    }
    await this.prisma.$transaction(
      dto.ids.map((id, i) =>
        this.prisma.rundownItem.update({ where: { id }, data: { urutan: i + 1 } }),
      ),
    );
    return this.acara.get(user, sesi.acaraId);
  }

  private async sesiManageable(user: AuthUser, id: string) {
    const sesi = await this.prisma.sesi.findFirst({ where: { id, deletedAt: null } });
    if (!sesi) throw notFound('Sesi', id);
    await this.acara.manageable(user, sesi.acaraId);
    return sesi;
  }

  private async assertPengisi(list: CreateRundownDto['pengisi']): Promise<void> {
    const ids = [...new Set(list.map((p) => p.anggotaId).filter((x): x is string => !!x))];
    if (!ids.length) return;
    const found = await this.prisma.anggotaRef.count({ where: { id: { in: ids } } });
    if (found !== ids.length)
      throw badRequest('PENGISI_INVALID', 'Anggota pengisi tidak ditemukan');
  }
}

function pengisiData(p: CreateRundownDto['pengisi'][number]) {
  return { anggotaId: p.anggotaId ?? null, namaBebas: p.namaBebas ?? null, peran: p.peran ?? null };
}
