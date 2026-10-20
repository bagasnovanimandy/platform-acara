import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BaileysTransport } from './baileys.transport.js';
import { FakeTransport, type PesanMasuk, type StatusWa, type WaTransport } from './transport.js';

/**
 * Pintu keluar-masuk pesan WA: mencatat semua pesan di PesanLog dan mengirim satu per satu
 * dengan jeda (bot tidak mengirim pesan massal).
 */
@Injectable()
export class WaService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WaService.name);
  private readonly transport: WaTransport =
    config().WA_DRIVER === 'baileys'
      ? new BaileysTransport(config().WA_AUTH_DIR)
      : new FakeTransport();
  private handler?: (p: PesanMasuk) => Promise<void>;
  private antrean: Promise<void> = Promise.resolve();
  private terakhirKirim = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** Dipasang oleh BotService. */
  setHandler(h: (p: PesanMasuk) => Promise<void>): void {
    this.handler = h;
  }

  onModuleInit(): void {
    if (config().NODE_ENV === 'test') return;
    // Tidak menunda start: menyambung ke WhatsApp bisa lama.
    void this.transport
      .mulai((p) => this.terima(p))
      .catch((e: unknown) => this.log.error(`WhatsApp gagal dimulai: ${String(e)}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.transport.berhenti();
  }

  async terima(p: PesanMasuk): Promise<void> {
    await this.prisma.pesanLog.create({ data: { noWa: p.noWa, arah: 'MASUK', isi: p.teks } });
    await this.handler?.(p);
  }

  /** Kirim satu pesan (berurutan, dengan jeda). Gagal kirim dicatat, tidak dilempar. */
  kirim(noWa: string, isi: string, izinId?: string): Promise<void> {
    const kerja = this.antrean.then(async () => {
      const jeda = config().WA_DRIVER === 'baileys' ? config().WA_JEDA_KIRIM_MS : 0;
      const tunggu = this.terakhirKirim + jeda - Date.now();
      if (tunggu > 0) await new Promise((r) => setTimeout(r, tunggu));
      try {
        await this.transport.kirim(noWa, isi);
        await this.prisma.pesanLog.create({
          data: { noWa, arah: 'KELUAR', isi, izinId: izinId ?? null },
        });
      } catch (e) {
        this.log.warn(`Gagal kirim ke ${noWa}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        this.terakhirKirim = Date.now();
      }
    });
    this.antrean = kerja;
    return kerja;
  }

  status(): StatusWa {
    return this.transport.status();
  }

  tautkanUlang(): Promise<void> {
    return this.transport.tautkanUlang();
  }
}
