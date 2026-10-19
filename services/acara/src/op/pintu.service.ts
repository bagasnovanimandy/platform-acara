import { HttpStatus, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { AcaraService } from '../acara/acara.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError, notFound } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buatKode, buatPin, buatQrToken } from './kredensial.js';
import { MonitorBus } from './monitor-bus.js';
import type { HeartbeatDto } from './op.dto.js';
import type { OperatorCtx } from './operator.guard.js';
import { statusPintu } from './status-pintu.js';

/** Token operator berlaku sampai sesi selesai + 2 jam (HANDOVER §5.2). */
export const MASA_BERLAKU_MS = 2 * 3600_000;
const MAKS_PINTU = 50;

export interface KartuPintu {
  id: string;
  nomor: number;
  label: string;
  kode: string;
  pin: string;
  url: string;
}

const qrUrl = (token: string) => `/op/login?t=${token}`;

/** Pintu (operator sementara) per sesi: generate, cabut, reset PIN, heartbeat, monitor. */
@Injectable()
export class PintuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraService,
    private readonly bus: MonitorBus,
  ) {}

  private async sesi(sesiId: string) {
    const sesi = await this.prisma.sesi.findFirst({ where: { id: sesiId, deletedAt: null } });
    if (!sesi) throw notFound('Sesi', sesiId);
    return sesi;
  }

  /** Sesi yang boleh dilihat user (admin, pengurus, auditor di wilayahnya). */
  async sesiTerlihat(user: AuthUser, sesiId: string) {
    const sesi = await this.sesi(sesiId);
    await this.acara.visible(user, sesi.acaraId);
    return sesi;
  }

  private async operatorKelola(user: AuthUser, id: string) {
    const op = await this.prisma.operatorSession.findUnique({
      where: { id },
      include: { sesi: true },
    });
    if (!op || op.sesi.deletedAt) throw notFound('Operator', id);
    await this.acara.manageable(user, op.sesi.acaraId);
    return op;
  }

  /** Buat N pintu baru (lanjut dari nomor terakhir). PIN & QR hanya ditampilkan sekali. */
  async generate(user: AuthUser, sesiId: string, jumlah: number): Promise<KartuPintu[]> {
    const sesi = await this.sesi(sesiId);
    await this.acara.manageable(user, sesi.acaraId);
    const ada = await this.prisma.operatorSession.count({ where: { sesiId } });
    if (ada + jumlah > MAKS_PINTU) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'PINTU_TERLALU_BANYAK',
        `Maksimal ${MAKS_PINTU} pintu per sesi`,
      );
    }
    const expiresAt = new Date(sesi.selesai.getTime() + MASA_BERLAKU_MS);
    const kartu: KartuPintu[] = [];
    for (let i = 0; i < jumlah; i++) {
      const pin = buatPin();
      const pinHash = await argon2.hash(pin);
      // Ulangi bila nomor/kode/token bentrok (generate bersamaan atau kode kembar).
      for (let attempt = 0; ; attempt++) {
        const last = await this.prisma.operatorSession.aggregate({
          where: { sesiId },
          _max: { nomor: true },
        });
        const nomor = (last._max.nomor ?? 0) + 1;
        const qrToken = buatQrToken();
        try {
          const op = await this.prisma.operatorSession.create({
            data: {
              sesiId,
              nomor,
              label: `Pintu ${nomor}`,
              kode: buatKode(),
              pinHash,
              qrToken,
              expiresAt,
              dibuatOleh: user.id,
            },
          });
          kartu.push({
            id: op.id,
            nomor,
            label: op.label,
            kode: op.kode,
            pin,
            url: qrUrl(qrToken),
          });
          break;
        } catch (e) {
          const unik = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
          if (!unik || attempt >= 4) throw e;
        }
      }
    }
    this.bus.emit(sesiId);
    return kartu;
  }

  /** PIN & QR baru; perangkat yang sudah login tetap jalan. */
  async resetPin(user: AuthUser, id: string): Promise<KartuPintu> {
    const op = await this.operatorKelola(user, id);
    if (op.revokedAt) {
      throw new AppError(HttpStatus.CONFLICT, 'OPERATOR_DICABUT', 'Pintu ini sudah dicabut');
    }
    const pin = buatPin();
    const qrToken = buatQrToken();
    await this.prisma.operatorSession.update({
      where: { id },
      data: {
        pinHash: await argon2.hash(pin),
        pinGagal: 0,
        terkunciSampai: null,
        qrToken,
        qrIssuedAt: new Date(),
        qrUsedAt: null,
      },
    });
    this.bus.emit(op.sesiId);
    return { id, nomor: op.nomor, label: op.label, kode: op.kode, pin, url: qrUrl(qrToken) };
  }

  /** Cabut akses: perangkat langsung ditolak pada request berikutnya. */
  async revoke(user: AuthUser, id: string) {
    const op = await this.operatorKelola(user, id);
    if (!op.revokedAt) {
      await this.prisma.operatorSession.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
    this.bus.emit(op.sesiId);
    return { id, revoked: true };
  }

  async heartbeat(op: OperatorCtx, dto: HeartbeatDto) {
    await this.prisma.operatorSession.update({
      where: { id: op.id },
      data: {
        lastSeenAt: new Date(),
        antrean: dto.antrean,
        sedangInput: dto.sedangInput,
        baterai: dto.baterai ?? null,
        ...(dto.perangkat ? { perangkat: dto.perangkat.slice(0, 200) } : {}),
      },
    });
    this.bus.emit(op.sesiId);
    return { ok: true };
  }

  /** Kondisi semua pintu sesi + ringkasan kehadiran (untuk daftar & SSE). */
  async snapshot(sesiId: string) {
    const now = new Date();
    const [ops, absensi, duplikat, hadir, tamu] = await Promise.all([
      this.prisma.operatorSession.findMany({ where: { sesiId }, orderBy: { nomor: 'asc' } }),
      this.prisma.absensi.groupBy({
        by: ['operatorSessionId'],
        where: { sesiId },
        _count: { _all: true },
      }),
      this.prisma.absensiDuplikat.groupBy({
        by: ['operatorSessionId'],
        where: { sesiId },
        _count: { _all: true },
      }),
      this.prisma.absensi.count({ where: { sesiId, anggotaId: { not: null } } }),
      this.prisma.tamu.count({ where: { sesiId } }),
    ]);
    const input = new Map<string | null, number>();
    for (const g of [...absensi, ...duplikat]) {
      input.set(g.operatorSessionId, (input.get(g.operatorSessionId) ?? 0) + g._count._all);
    }
    return {
      now,
      hadir,
      tamu,
      pintu: ops.map((o) => ({
        id: o.id,
        nomor: o.nomor,
        label: o.label,
        kode: o.kode,
        status: statusPintu(o, now),
        lastSeenAt: o.lastSeenAt,
        lastScanAt: o.lastScanAt,
        antrean: o.antrean,
        sedangInput: o.sedangInput,
        baterai: o.baterai,
        perangkat: o.perangkat,
        qrDipakai: o.qrUsedAt !== null,
        revokedAt: o.revokedAt,
        jumlahInput: input.get(o.id) ?? 0,
      })),
    };
  }

  perubahan(sesiId: string) {
    return this.bus.sesi(sesiId);
  }
}
