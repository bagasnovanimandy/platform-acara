import { HttpStatus, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { AcaraService } from '../acara/acara.service.js';
import { pesertaWhere } from '../acara/peserta.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError, notFound } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QR_BERLAKU_MS } from './kredensial.js';
import { MonitorBus } from './monitor-bus.js';
import type { AbsensiItem, OpLoginDto } from './op.dto.js';
import type { OperatorCtx } from './operator.guard.js';
import { signOperatorToken } from './operator-token.js';

/** 5 PIN salah berturut-turut mengunci pintu itu 5 menit. */
const PIN_MAKS_GAGAL = 5;
const PIN_KUNCI_MS = 5 * 60_000;

export type HasilStatus = 'BARU' | 'LEBIH_AWAL' | 'DUPLIKAT' | 'SUDAH_DITERIMA' | 'DITOLAK';
export interface HasilItem {
  clientId: string;
  status: HasilStatus;
  alasan?: string;
}

type Sesi = { id: string; mulai: Date; toleransiMenit: number };

@Injectable()
export class OpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraService,
    private readonly bus: MonitorBus,
  ) {}

  /** Login perangkat dengan token QR (sekali pakai, 24 jam) atau kode pintu + PIN. */
  async login(dto: OpLoginDto) {
    const now = new Date();
    const op = dto.token
      ? await this.loginQr(dto.token, now)
      : await this.loginPin(dto.kode ?? '', dto.pin ?? '', now);
    await this.prisma.operatorSession.update({
      where: { id: op.id },
      data: {
        lastSeenAt: now,
        ...(dto.perangkat ? { perangkat: dto.perangkat.slice(0, 200) } : {}),
      },
    });
    this.bus.emit(op.sesiId);
    return {
      token: await signOperatorToken({ sid: op.id, sesiId: op.sesiId }, op.expiresAt),
      expiresAt: op.expiresAt,
      operator: { id: op.id, label: op.label },
      sesi: { id: op.sesiId, nama: op.sesi.nama, acara: op.sesi.acara.nama },
    };
  }

  private async loginQr(token: string, now: Date) {
    const op = await this.prisma.operatorSession.findUnique({
      where: { qrToken: token },
      include: { sesi: { include: { acara: true } } },
    });
    if (
      !op ||
      op.revokedAt ||
      op.expiresAt < now ||
      op.qrIssuedAt.getTime() + QR_BERLAKU_MS < now.getTime()
    ) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'QR_INVALID', 'QR tidak berlaku');
    }
    const used = await this.prisma.operatorSession.updateMany({
      where: { id: op.id, qrUsedAt: null },
      data: { qrUsedAt: now },
    });
    if (used.count === 0) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'QR_USED', 'QR sudah dipakai perangkat lain');
    }
    return op;
  }

  private async loginPin(kode: string, pin: string, now: Date) {
    const op = await this.prisma.operatorSession.findUnique({
      where: { kode },
      include: { sesi: { include: { acara: true } } },
    });
    const salah = () =>
      new AppError(HttpStatus.UNAUTHORIZED, 'PIN_INVALID', 'Kode pintu atau PIN salah');
    if (!op || op.revokedAt || op.expiresAt < now) throw salah();
    if (op.terkunciSampai && op.terkunciSampai > now) {
      throw new AppError(
        HttpStatus.TOO_MANY_REQUESTS,
        'PIN_TERKUNCI',
        'Terlalu banyak PIN salah. Coba lagi beberapa menit lagi.',
        { sampai: op.terkunciSampai },
      );
    }
    if (!(await argon2.verify(op.pinHash, pin))) {
      const gagal = op.pinGagal + 1;
      await this.prisma.operatorSession.update({
        where: { id: op.id },
        data:
          gagal >= PIN_MAKS_GAGAL
            ? { pinGagal: 0, terkunciSampai: new Date(now.getTime() + PIN_KUNCI_MS) }
            : { pinGagal: gagal },
      });
      throw salah();
    }
    if (op.pinGagal > 0) {
      await this.prisma.operatorSession.update({ where: { id: op.id }, data: { pinGagal: 0 } });
    }
    return op;
  }

  /**
   * Paket offline: peserta sesi + embedding wajah VERIFIED/PENDING.
   * Tanpa data pribadi (AGENTS.md): hanya id, kode, nama, kelompok, embedding.
   */
  async paket(op: OperatorCtx) {
    const sesi = await this.prisma.sesi.findFirst({
      where: { id: op.sesiId, deletedAt: null },
      include: { acara: { include: { pesertaRules: true } } },
    });
    if (!sesi || sesi.acara.deletedAt) throw notFound('Sesi', op.sesiId);
    const peserta = await this.prisma.anggotaRef.findMany({
      where: pesertaWhere(sesi.acara.pesertaRules),
      select: { id: true, kode: true, nama: true, namaKelompok: true },
      orderBy: { nama: 'asc' },
    });
    const ids = peserta.map((p) => p.id);
    const [wajah, hadir] = await Promise.all([
      this.prisma.faceData.findMany({
        where: { anggotaId: { in: ids }, status: { in: ['VERIFIED', 'PENDING'] } },
        select: { id: true, anggotaId: true, status: true, embeddings: true },
      }),
      this.prisma.absensi.findMany({
        where: { sesiId: sesi.id, anggotaId: { not: null } },
        select: { anggotaId: true },
      }),
    ]);
    await this.prisma.operatorSession.update({
      where: { id: op.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      dibuatAt: new Date(),
      operator: { id: op.id, label: op.label },
      sesi: {
        id: sesi.id,
        nama: sesi.nama,
        mulai: sesi.mulai,
        selesai: sesi.selesai,
        toleransiMenit: sesi.toleransiMenit,
        acara: { id: sesi.acara.id, nama: sesi.acara.nama, lokasi: sesi.acara.lokasi },
      },
      threshold: sesi.acara.thresholdWajah,
      peserta: peserta.map((p) => ({
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        kelompok: p.namaKelompok,
      })),
      wajah: wajah.map((w) => ({
        id: w.id,
        anggotaId: w.anggotaId,
        status: w.status,
        descriptors: w.embeddings as number[][],
      })),
      sudahHadir: hadir.map((h) => h.anggotaId!),
    };
  }

  /**
   * Simpan antrean absensi dari perangkat. Idempoten per `clientId`.
   * Satu anggota satu absensi per sesi: yang `capturedAt`-nya paling awal menang,
   * scan lain masuk AbsensiDuplikat.
   */
  async batch(op: OperatorCtx, items: AbsensiItem[]) {
    const sesi = await this.prisma.sesi.findFirst({
      where: { id: op.sesiId, deletedAt: null },
      include: { acara: { include: { pesertaRules: true } } },
    });
    if (!sesi) throw notFound('Sesi', op.sesiId);
    const anggotaIds = [
      ...new Set(items.flatMap((i) => (i.metode === 'TAMU' ? [] : [i.anggotaId]))),
    ];
    const peserta = new Set(
      (
        await this.prisma.anggotaRef.findMany({
          where: { AND: [pesertaWhere(sesi.acara.pesertaRules), { id: { in: anggotaIds } }] },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    const hasil: HasilItem[] = [];
    // Urut waktu ambil agar scan paling awal diproses lebih dulu.
    const urut = [...items].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    for (const item of urut) hasil.push(await this.simpan(op, sesi, item, peserta));
    let lastScan: Date | undefined;
    for (const i of items) {
      const t = new Date(i.capturedAt);
      if (!lastScan || t > lastScan) lastScan = t;
    }
    await this.prisma.operatorSession.update({
      where: { id: op.id },
      data: { lastSeenAt: new Date(), lastScanAt: lastScan },
    });
    this.bus.emit(op.sesiId);
    const hitung = (s: HasilStatus) => hasil.filter((h) => h.status === s).length;
    return {
      hasil,
      ringkas: {
        baru: hitung('BARU') + hitung('LEBIH_AWAL'),
        duplikat: hitung('DUPLIKAT'),
        sudahDiterima: hitung('SUDAH_DITERIMA'),
        ditolak: hitung('DITOLAK'),
      },
    };
  }

  private async simpan(
    op: OperatorCtx,
    sesi: Sesi,
    item: AbsensiItem,
    peserta: Set<string>,
  ): Promise<HasilItem> {
    const { clientId } = item;
    const capturedAt = new Date(item.capturedAt);
    const [a, d] = await Promise.all([
      this.prisma.absensi.findUnique({ where: { clientId }, select: { id: true } }),
      this.prisma.absensiDuplikat.findUnique({ where: { clientId }, select: { id: true } }),
    ]);
    if (a || d) return { clientId, status: 'SUDAH_DITERIMA' };
    const terlambat = capturedAt.getTime() > sesi.mulai.getTime() + sesi.toleransiMenit * 60_000;

    if (item.metode === 'TAMU') {
      await this.prisma.$transaction(async (tx) => {
        const tamu = await tx.tamu.create({
          data: { sesiId: sesi.id, nama: item.nama, keterangan: item.keterangan ?? null },
        });
        await tx.absensi.create({
          data: {
            clientId,
            sesiId: sesi.id,
            tamuId: tamu.id,
            metode: 'TAMU',
            operatorSessionId: op.id,
            capturedAt,
            terlambat,
          },
        });
      });
      return { clientId, status: 'BARU' };
    }

    if (!peserta.has(item.anggotaId)) {
      return { clientId, status: 'DITOLAK', alasan: 'Bukan peserta sesi ini' };
    }
    let faceDataId: string | null = null;
    let faceDistance: number | null = null;
    let perluTinjau = false;
    if (item.metode === 'WAJAH') {
      faceDistance = item.faceDistance ?? null;
      if (item.faceDataId) {
        // Wajah yang baru didaftarkan di perangkat masih memakai clientId sebagai id.
        const f = await this.prisma.faceData.findFirst({
          where: { OR: [{ id: item.faceDataId }, { clientId: item.faceDataId }] },
        });
        if (f && f.anggotaId === item.anggotaId && f.status !== 'REJECTED') faceDataId = f.id;
        else perluTinjau = true;
      }
    }
    const data = {
      clientId,
      metode: item.metode,
      operatorSessionId: op.id,
      faceDataId,
      faceDistance,
      capturedAt,
      terlambat,
      perluTinjau,
    };

    // Dua percobaan: bila pintu lain menyimpan anggota yang sama bersamaan (unik sesi+anggota).
    for (let attempt = 0; ; attempt++) {
      const existing = await this.prisma.absensi.findUnique({
        where: { sesiId_anggotaId: { sesiId: sesi.id, anggotaId: item.anggotaId } },
      });
      try {
        if (!existing) {
          await this.prisma.absensi.create({
            data: { ...data, sesiId: sesi.id, anggotaId: item.anggotaId },
          });
          return { clientId, status: 'BARU' };
        }
        if (capturedAt < existing.capturedAt) {
          await this.prisma.$transaction([
            this.prisma.absensiDuplikat.create({
              data: {
                clientId: existing.clientId,
                sesiId: sesi.id,
                anggotaId: item.anggotaId,
                operatorSessionId: existing.operatorSessionId,
                capturedAt: existing.capturedAt,
              },
            }),
            this.prisma.absensi.update({ where: { id: existing.id }, data }),
          ]);
          return { clientId, status: 'LEBIH_AWAL' };
        }
        await this.prisma.absensiDuplikat.create({
          data: {
            clientId,
            sesiId: sesi.id,
            anggotaId: item.anggotaId,
            operatorSessionId: op.id,
            capturedAt,
          },
        });
        return { clientId, status: 'DUPLIKAT' };
      } catch (e) {
        const unik = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!unik || attempt >= 2) throw e;
      }
    }
  }

  /** Daftar kehadiran satu sesi untuk admin/pengurus/auditor. */
  async kehadiran(user: AuthUser, sesiId: string) {
    const sesi = await this.prisma.sesi.findFirst({ where: { id: sesiId, deletedAt: null } });
    if (!sesi) throw notFound('Sesi', sesiId);
    const acara = await this.acara.get(user, sesi.acaraId);
    const [absensi, tamu, operator] = await Promise.all([
      this.prisma.absensi.findMany({
        where: { sesiId },
        orderBy: { capturedAt: 'asc' },
      }),
      this.prisma.tamu.findMany({ where: { sesiId } }),
      this.prisma.operatorSession.findMany({
        where: { sesiId },
        select: { id: true, label: true, lastSeenAt: true, lastScanAt: true, revokedAt: true },
        orderBy: { nomor: 'asc' },
      }),
    ]);
    const anggota = await this.prisma.anggotaRef.findMany({
      where: { id: { in: absensi.flatMap((a) => (a.anggotaId ? [a.anggotaId] : [])) } },
      select: { id: true, kode: true, nama: true, namaKelompok: true },
    });
    const wajahPending = new Set(
      (
        await this.prisma.faceData.findMany({
          where: {
            id: { in: absensi.flatMap((a) => (a.faceDataId ? [a.faceDataId] : [])) },
            status: 'PENDING',
          },
          select: { id: true },
        })
      ).map((f) => f.id),
    );
    const byId = new Map(anggota.map((a) => [a.id, a]));
    const tamuById = new Map(tamu.map((t) => [t.id, t]));
    const opById = new Map(operator.map((o) => [o.id, o.label]));
    return {
      peserta: acara.jumlahPeserta,
      hadir: absensi.filter((a) => a.anggotaId).length,
      tamu: tamu.length,
      operator,
      items: absensi.map((a) => ({
        id: a.id,
        metode: a.metode,
        capturedAt: a.capturedAt,
        terlambat: a.terlambat,
        perluTinjau: a.perluTinjau,
        wajahPending: a.faceDataId ? wajahPending.has(a.faceDataId) : false,
        pintu: a.operatorSessionId ? (opById.get(a.operatorSessionId) ?? null) : null,
        anggota: a.anggotaId ? (byId.get(a.anggotaId) ?? null) : null,
        tamu: a.tamuId ? (tamuById.get(a.tamuId)?.nama ?? null) : null,
      })),
    };
  }
}
