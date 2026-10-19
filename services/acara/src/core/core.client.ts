import { HttpStatus, Injectable } from '@nestjs/common';
import type { EventPayload } from '@platform-acara/shared';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';
import type { WilayahTree } from '../scope/scope.js';

export interface CoreScope {
  user: { id: string; nama: string; role: string; aktif: boolean };
  all: boolean;
  manageDaerah: string[];
  manageDesa: string[];
  manageKelompok: string[];
  visibleDaerah: string[];
  visibleDesa: string[];
}

/** Cache sederhana berbasis waktu; janji yang gagal tidak disimpan. */
class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();
  constructor(private readonly ttlMs: number) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const value = load();
    this.entries.set(key, { at: Date.now(), value });
    value.catch(() => this.entries.delete(key));
    return value;
  }
}

/** Klien HTTP ke core-svc /internal/* (header x-internal-key). */
@Injectable()
export class CoreClient {
  private readonly wilayahCache = new TtlCache<WilayahTree>(60_000);
  /** Perubahan scope di core berlaku di sini paling lambat 30 dtk. */
  private readonly scopeCache = new TtlCache<CoreScope>(30_000);

  async get<T>(path: string): Promise<T> {
    const cfg = config();
    let res: Response;
    try {
      res = await fetch(new URL(`/internal${path}`, cfg.CORE_URL), {
        headers: { 'x-internal-key': cfg.INTERNAL_KEY ?? '' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AppError(
        HttpStatus.BAD_GATEWAY,
        'CORE_UNAVAILABLE',
        'core-svc tidak bisa dihubungi',
      );
    }
    if (!res.ok) {
      throw new AppError(HttpStatus.BAD_GATEWAY, 'CORE_ERROR', `core-svc membalas ${res.status}`);
    }
    return (await res.json()) as T;
  }

  wilayah(): Promise<WilayahTree> {
    return this.wilayahCache.get('tree', () => this.get<WilayahTree>('/wilayah'));
  }

  scope(userId: string): Promise<CoreScope> {
    return this.scopeCache.get(userId, () =>
      this.get<CoreScope>(`/users/${encodeURIComponent(userId)}/scope`),
    );
  }

  users(ids: string[]): Promise<{ id: string; nama: string; role: string }[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.get(`/users?ids=${ids.map(encodeURIComponent).join(',')}`);
  }

  anggota(updatedSince?: Date): Promise<EventPayload<'anggota.upserted'>[]> {
    const q = updatedSince ? `?updatedSince=${encodeURIComponent(updatedSince.toISOString())}` : '';
    return this.get(`/anggota${q}`);
  }
}
