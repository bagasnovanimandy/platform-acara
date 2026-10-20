import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EVENTS, type EventPayload, parseEvent, QUEUES } from '@platform-acara/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { CoreClient } from '../core/core.client.js';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RekapService } from '../rekap/rekap.service.js';
import { toAnggotaRef } from './anggota-sync.js';

/**
 * Menjaga AnggotaRef tetap sama dengan core:
 * - consumer BullMQ `acara-events` (anggota.upserted / anggota.mutasi),
 * - resync dari GET /internal/anggota?updatedSince= saat start dan lewat POST /sync/anggota.
 */
@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private worker?: Worker;
  private connection?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreClient,
    private readonly rekap: RekapService,
  ) {}

  onModuleInit(): void {
    const url = config().REDIS_URL;
    if (url && config().NODE_ENV !== 'test') {
      this.connection = new Redis(url, { maxRetriesPerRequest: null });
      this.worker = new Worker(QUEUES.ACARA, (job) => this.handle(job.name, job.data), {
        connection: this.connection,
      });
      this.worker.on('failed', (job, err) =>
        this.logger.warn(`Job ${job?.name} gagal: ${err.message}`),
      );
    }
    // Tidak menunda start: core mungkin belum siap.
    void this.resync().catch((e: unknown) =>
      this.logger.warn(`Resync awal gagal: ${e instanceof Error ? e.message : String(e)}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.connection?.disconnect();
  }

  async handle(name: string, data: unknown): Promise<void> {
    if (name === EVENTS.ANGGOTA_UPSERTED) {
      await this.upsert([parseEvent(EVENTS.ANGGOTA_UPSERTED, data)]);
    } else if (name === EVENTS.ANGGOTA_MUTASI) {
      // Wilayah baru datang lewat anggota.upserted berikutnya; cukup dicatat.
      const e = parseEvent(EVENTS.ANGGOTA_MUTASI, data);
      this.logger.log(`Mutasi ${e.anggotaId}: ${e.dariKelompokId} → ${e.keKelompokId}`);
    } else if (name === EVENTS.IZIN_SUBMITTED) {
      const e = parseEvent(EVENTS.IZIN_SUBMITTED, data);
      await this.prisma.izinRef.upsert({
        where: { id: e.izinId },
        create: {
          id: e.izinId,
          anggotaId: e.anggotaId,
          acaraId: e.acaraId,
          sesiId: e.sesiId ?? null,
          kategori: e.kategori,
          status: 'SUBMITTED',
        },
        // Keputusan bisa datang lebih dulu: jangan timpa statusnya.
        update: {
          anggotaId: e.anggotaId,
          acaraId: e.acaraId,
          sesiId: e.sesiId ?? null,
          kategori: e.kategori,
        },
      });
    } else if (name === EVENTS.IZIN_DECIDED) {
      const e = parseEvent(EVENTS.IZIN_DECIDED, data);
      const izin = await this.prisma.izinRef.findUnique({ where: { id: e.izinId } });
      // izin.submitted belum diterima: lempar agar BullMQ mencoba lagi nanti.
      if (!izin) throw new Error(`IzinRef ${e.izinId} belum ada`);
      await this.prisma.izinRef.update({ where: { id: e.izinId }, data: { status: e.status } });
      // Izin yang diputuskan setelah sesi ditutup ikut mengubah rekap.
      await this.rekap.hitungUlangIzin(izin.acaraId, izin.sesiId);
    }
  }

  /** Tarik anggota yang berubah sejak perubahan terakhir yang sudah ada di sini (`full` = semua). */
  async resync(full = false): Promise<number> {
    const last = full
      ? undefined
      : (await this.prisma.anggotaRef.aggregate({ _max: { updatedAt: true } }))._max.updatedAt;
    const rows = await this.core.anggota(last ?? undefined);
    await this.upsert(rows);
    if (rows.length) this.logger.log(`Resync ${rows.length} anggota dari core`);
    return rows.length;
  }

  /** Event bisa datang tidak berurutan: data yang lebih lama dari yang tersimpan diabaikan. */
  private async upsert(rows: EventPayload<'anggota.upserted'>[]): Promise<void> {
    for (const a of rows) {
      const data = toAnggotaRef(a);
      const current = await this.prisma.anggotaRef.findUnique({
        where: { id: a.id },
        select: { updatedAt: true },
      });
      if (current && current.updatedAt > data.updatedAt) continue;
      await this.prisma.anggotaRef.upsert({ where: { id: a.id }, create: data, update: data });
    }
  }
}
