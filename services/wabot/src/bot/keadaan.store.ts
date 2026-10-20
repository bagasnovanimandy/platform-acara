import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import type { Keadaan } from './mesin.js';

const TTL_DETIK = 600;

/** State percakapan per nomor di Redis (`bot:state:{noWa}`, TTL 10 menit); tanpa Redis di memori. */
@Injectable()
export class KeadaanStore implements OnModuleDestroy {
  private readonly redis = config().REDIS_URL
    ? new Redis(config().REDIS_URL!, { maxRetriesPerRequest: 2, lazyConnect: true })
    : undefined;
  private readonly memori = new Map<string, { k: string; sampai: number }>();

  async ambil(kunci: string): Promise<string | null> {
    if (this.redis) return this.redis.get(kunci);
    const v = this.memori.get(kunci);
    return v && v.sampai > Date.now() ? v.k : null;
  }

  async simpan(kunci: string, nilai: string, ttl = TTL_DETIK): Promise<void> {
    if (this.redis) {
      await this.redis.set(kunci, nilai, 'EX', ttl);
      return;
    }
    this.memori.set(kunci, { k: nilai, sampai: Date.now() + ttl * 1000 });
  }

  async hapus(kunci: string): Promise<void> {
    if (this.redis) await this.redis.del(kunci);
    else this.memori.delete(kunci);
  }

  async keadaan(noWa: string): Promise<Keadaan | null> {
    const v = await this.ambil(`bot:state:${noWa}`);
    return v ? (JSON.parse(v) as Keadaan) : null;
  }

  async setKeadaan(noWa: string, k: Keadaan | null): Promise<void> {
    if (k) await this.simpan(`bot:state:${noWa}`, JSON.stringify(k));
    else await this.hapus(`bot:state:${noWa}`);
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}
