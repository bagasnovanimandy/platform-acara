import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EVENTS } from '@platform-acara/shared';
import sharp from 'sharp';
import { pesertaWhere } from '../acara/peserta.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError, badRequest, forbiddenScope, notFound } from '../common/app-error.js';
import { type Paginated, skipTake } from '../common/pagination.js';
import { EventsService } from '../events/events.service.js';
import { uploadRoot } from '../foto/foto.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { OperatorCtx } from '../op/operator.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManage, type Scope } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type { EnrollDto } from './face.dto.js';
import { FaceBus } from './face-bus.js';

const THUMB_SISI = 160;
const POSE = ['Lurus', 'Kiri', 'Kanan', 'Atas', 'Bawah'] as const;

const anggotaSelect = {
  id: true,
  kode: true,
  nama: true,
  jenisKelamin: true,
  kelompokId: true,
  namaKelompok: true,
  namaDesa: true,
} as const;

function anggotaScope(s: Scope): Prisma.AnggotaRefWhereInput {
  return s.all ? {} : { kelompokId: { in: [...s.manageKelompok] } };
}

const bolehKelola = (s: Scope, a: { kelompokId: string }) =>
  canManage(s, { level: 'KELOMPOK', id: a.kelompokId });

const sudahDiputus = () =>
  new AppError(HttpStatus.CONFLICT, 'WAJAH_SUDAH_DIPUTUS', 'Wajah ini sudah diverifikasi');

@Injectable()
export class FaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly events: EventsService,
    private readonly bus: FaceBus,
  ) {}

  /**
   * Wajah baru dari perangkat pintu: 5 embedding + 5 thumbnail, status PENDING
   * (langsung dipakai untuk pengenalan, menunggu verifikasi admin). Idempoten per `clientId`.
   */
  async enroll(op: OperatorCtx, dto: EnrollDto) {
    const ada = await this.prisma.faceData.findUnique({
      where: { clientId: dto.clientId },
      select: { id: true, anggotaId: true, status: true },
    });
    if (ada) return { ...ada, baru: false };

    const sesi = await this.prisma.sesi.findFirst({
      where: { id: op.sesiId, deletedAt: null },
      include: { acara: { include: { pesertaRules: true } } },
    });
    if (!sesi) throw notFound('Sesi', op.sesiId);
    const peserta = await this.prisma.anggotaRef.findFirst({
      where: { AND: [pesertaWhere(sesi.acara.pesertaRules), { id: dto.anggotaId }] },
      select: { id: true },
    });
    if (!peserta) throw badRequest('BUKAN_PESERTA', 'Anggota bukan peserta sesi ini');

    let thumbs: Buffer[];
    try {
      thumbs = await Promise.all(
        dto.thumbnails.map((b64) =>
          sharp(Buffer.from(b64, 'base64'), { failOn: 'error' })
            .resize(THUMB_SISI, THUMB_SISI, { fit: 'cover' })
            .webp({ quality: 75 })
            .toBuffer(),
        ),
      );
    } catch {
      throw badRequest('THUMBNAIL_INVALID', 'Thumbnail wajah tidak bisa dibaca');
    }

    let row;
    try {
      row = await this.prisma.faceData.create({
        data: {
          clientId: dto.clientId,
          anggotaId: dto.anggotaId,
          embeddings: dto.descriptors,
          thumbnails: [],
          status: 'PENDING',
          sumber: 'OPERATOR',
          enrolledByOperatorSessionId: op.id,
          createdAt: new Date(dto.capturedAt),
        },
      });
    } catch (e) {
      // Kiriman ganda bersamaan dengan clientId yang sama.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const f = await this.prisma.faceData.findUniqueOrThrow({
          where: { clientId: dto.clientId },
          select: { id: true, anggotaId: true, status: true },
        });
        return { ...f, baru: false };
      }
      throw e;
    }
    const rel = join('wajah', row.id);
    await mkdir(join(uploadRoot(), rel), { recursive: true });
    const paths = thumbs.map((_, i) => join(rel, `${i}.webp`));
    await Promise.all(thumbs.map((t, i) => writeFile(join(uploadRoot(), paths[i]!), t)));
    await this.prisma.faceData.update({ where: { id: row.id }, data: { thumbnails: paths } });

    this.bus.emit();
    await this.events.publish(EVENTS.FACE_ENROLLED, {
      faceDataId: row.id,
      anggotaId: row.anggotaId,
      operatorLabel: op.label,
    });
    return { id: row.id, anggotaId: row.anggotaId, status: row.status, baru: true };
  }

  async jumlahPending(user: AuthUser): Promise<number> {
    const s = await this.scopes.forUser(user);
    return this.prisma.faceData.count({
      where: { status: 'PENDING', anggota: anggotaScope(s) },
    });
  }

  async pending(user: AuthUser, page: number, pageSize: number): Promise<Paginated<unknown>> {
    const s = await this.scopes.forUser(user);
    const where: Prisma.FaceDataWhereInput = { status: 'PENDING', anggota: anggotaScope(s) };
    const [items, total] = await Promise.all([
      this.prisma.faceData.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        ...skipTake({ page, pageSize }),
        include: {
          anggota: { select: anggotaSelect },
          enrolledByOperator: {
            select: {
              label: true,
              sesi: { select: { nama: true, acara: { select: { nama: true } } } },
            },
          },
        },
      }),
      this.prisma.faceData.count({ where }),
    ]);
    return { items: items.map((f) => this.ringkas(f)), total, page, pageSize };
  }

  /** Detail satu wajah + wajah VERIFIED anggota yang sama sebagai pembanding. */
  async detail(user: AuthUser, id: string) {
    const f = await this.ambil(user, id);
    const sebelumnya = await this.prisma.faceData.findMany({
      where: { anggotaId: f.anggotaId, status: 'VERIFIED', id: { not: f.id } },
      orderBy: { verifiedAt: 'desc' },
      take: 3,
      select: { id: true, thumbnails: true, verifiedAt: true, sumber: true },
    });
    const absensi = await this.prisma.absensi.count({ where: { faceDataId: f.id } });
    return {
      ...this.ringkas(f),
      alasanTolak: f.alasanTolak,
      verifiedAt: f.verifiedAt,
      absensi,
      sebelumnya: sebelumnya.map((p) => ({
        id: p.id,
        verifiedAt: p.verifiedAt,
        sumber: p.sumber,
        jumlahThumbnail: p.thumbnails.length,
      })),
    };
  }

  async thumbnail(user: AuthUser, id: string, i: number): Promise<string> {
    const f = await this.ambil(user, id);
    const p = f.thumbnails[i];
    if (!p) throw notFound('Thumbnail', `${id}/${i}`);
    return join(uploadRoot(), p);
  }

  async setujui(user: AuthUser, id: string) {
    const f = await this.ambil(user, id, true);
    if (f.status !== 'PENDING') throw sudahDiputus();
    await this.prisma.faceData.update({
      where: { id },
      data: { status: 'VERIFIED', verifiedBy: user.id, verifiedAt: new Date() },
    });
    this.bus.emit();
    return { id, status: 'VERIFIED' as const };
  }

  /**
   * Tolak: wajah keluar dari paket offline, embedding & thumbnail dihapus permanen
   * (AGENTS.md: satu-satunya data yang boleh dihapus), absensi yang memakainya ditandai perluTinjau.
   */
  async tolak(user: AuthUser, id: string, alasan?: string) {
    const f = await this.ambil(user, id, true);
    if (f.status !== 'PENDING') throw sudahDiputus();
    const [, ditandai] = await this.prisma.$transaction([
      this.prisma.faceData.update({
        where: { id },
        data: {
          status: 'REJECTED',
          embeddings: [],
          thumbnails: [],
          verifiedBy: user.id,
          verifiedAt: new Date(),
          alasanTolak: alasan || null,
        },
      }),
      this.prisma.absensi.updateMany({ where: { faceDataId: id }, data: { perluTinjau: true } }),
    ]);
    await rm(join(uploadRoot(), 'wajah', id), { recursive: true, force: true });
    this.bus.emit();
    return { id, status: 'REJECTED' as const, absensiDitandai: ditandai.count };
  }

  /** Wajah milik orang lain: pindahkan ke anggota yang benar lalu setujui. */
  async gantiAnggota(user: AuthUser, id: string, anggotaId: string) {
    const f = await this.ambil(user, id, true);
    if (f.status !== 'PENDING') throw sudahDiputus();
    if (anggotaId === f.anggotaId) throw badRequest('ANGGOTA_SAMA', 'Pilih anggota lain');
    const s = await this.scopes.forUser(user);
    const target = await this.prisma.anggotaRef.findUnique({
      where: { id: anggotaId },
      select: { kelompokId: true },
    });
    if (!target) throw notFound('Anggota', anggotaId);
    if (!bolehKelola(s, target)) throw forbiddenScope();
    const [, ditandai] = await this.prisma.$transaction([
      this.prisma.faceData.update({
        where: { id },
        data: { anggotaId, status: 'VERIFIED', verifiedBy: user.id, verifiedAt: new Date() },
      }),
      this.prisma.absensi.updateMany({ where: { faceDataId: id }, data: { perluTinjau: true } }),
    ]);
    this.bus.emit();
    return { id, anggotaId, status: 'VERIFIED' as const, absensiDitandai: ditandai.count };
  }

  private async ambil(user: AuthUser, id: string, kelola = false) {
    const f = await this.prisma.faceData.findUnique({
      where: { id },
      include: {
        anggota: { select: anggotaSelect },
        enrolledByOperator: {
          select: {
            label: true,
            sesi: { select: { nama: true, acara: { select: { nama: true } } } },
          },
        },
      },
    });
    if (!f) throw notFound('Wajah', id);
    const s = await this.scopes.forUser(user);
    if (!bolehKelola(s, f.anggota)) throw kelola ? forbiddenScope() : notFound('Wajah', id);
    return f;
  }

  private ringkas(f: {
    id: string;
    status: string;
    sumber: string;
    createdAt: Date;
    thumbnails: string[];
    anggota: { id: string; kode: string; nama: string; namaKelompok: string; namaDesa: string };
    enrolledByOperator: { label: string; sesi: { nama: string; acara: { nama: string } } } | null;
  }) {
    return {
      id: f.id,
      status: f.status,
      sumber: f.sumber,
      createdAt: f.createdAt,
      jumlahThumbnail: f.thumbnails.length,
      pose: POSE.slice(0, f.thumbnails.length),
      anggota: {
        id: f.anggota.id,
        kode: f.anggota.kode,
        nama: f.anggota.nama,
        namaKelompok: f.anggota.namaKelompok,
        namaDesa: f.anggota.namaDesa,
      },
      pintu: f.enrolledByOperator?.label ?? null,
      sesi: f.enrolledByOperator
        ? { nama: f.enrolledByOperator.sesi.nama, acara: f.enrolledByOperator.sesi.acara.nama }
        : null,
    };
  }
}
