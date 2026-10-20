import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EVENTS, type EventPayload, parseEvent, QUEUES } from '@platform-acara/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { CoreClient } from '../clients/core.client.js';
import { config } from '../config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Payload anggota.upserted → baris AnggotaRef (hanya yang dibutuhkan bot). */
export function toAnggotaRef(a: EventPayload<'anggota.upserted'>): Prisma.AnggotaRefCreateInput {
  return {
    id: a.id,
    kode: a.kode,
    nama: a.nama,
    kelompokId: a.kelompokId,
    desaId: a.desaId,
    daerahId: a.daerahId,
    namaKelompok: a.namaKelompok,
    namaDesa: a.namaDesa,
    status: a.status,
    noWa: a.noWa,
    waliNoWa: a.waliNoWa,
    updatedAt: new Date(a.updatedAt),
    syncedAt: new Date(),
  };
}

/**
 * Menjaga AnggotaRef sama dengan core: consumer BullMQ `wabot-events` dan resync dari
 * GET /internal/anggota?updatedSince= saat start dan lewat POST /sync/anggota.
 */
@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private worker?: Worker;
  private connection?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreClient,
  ) {}

  onModuleInit(): void {
    const url = config().REDIS_URL;
    if (url && config().NODE_ENV !== 'test') {
      this.connection = new Redis(url, { maxRetriesPerRequest: null });
      this.worker = new Worker(QUEUES.WABOT, (job) => this.handle(job.name, job.data), {
        connection: this.connection,
      });
      this.worker.on('failed', (job, err) =>
        this.logger.warn(`Job ${job?.name} gagal: ${err.message}`),
      );
    }
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
    } else if (name === EVENTS.FACE_ENROLLED || name === EVENTS.SESI_CLOSED) {
      // Notifikasi WA opsional untuk admin/PJ belum dikirim (lihat PROGRESS).
      parseEvent(name, data);
    }
  }

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
