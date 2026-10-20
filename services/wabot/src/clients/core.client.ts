import { Injectable } from '@nestjs/common';
import type { EventPayload } from '@platform-acara/shared';
import { notFound } from '../common/app-error.js';
import { config } from '../config.js';
import { internalGet, TtlCache } from './http.js';

export interface CoreScope {
  user: { id: string; nama: string; role: string; aktif: boolean };
  all: boolean;
  manageDaerah: string[];
  manageDesa: string[];
  manageKelompok: string[];
  visibleDaerah: string[];
  visibleDesa: string[];
}

export interface CoreUser {
  id: string;
  nama: string;
  role: string;
  aktif: boolean;
  noWa?: string | null;
}

/** Klien HTTP ke core-svc /internal/*. */
@Injectable()
export class CoreClient {
  /** Perubahan scope di core berlaku di sini paling lambat 30 dtk. */
  private readonly scopeCache = new TtlCache<CoreScope>(30_000);

  private get<T>(path: string): Promise<T | null> {
    return internalGet<T>(config().CORE_URL, 'core-svc', path);
  }

  async scope(userId: string): Promise<CoreScope> {
    return this.scopeCache.get(userId, async () => {
      const s = await this.get<CoreScope>(`/users/${encodeURIComponent(userId)}/scope`);
      if (!s) throw notFound('User', userId);
      return s;
    });
  }

  async users(ids: string[]): Promise<CoreUser[]> {
    if (ids.length === 0) return [];
    return (
      (await this.get<CoreUser[]>(`/users?ids=${ids.map(encodeURIComponent).join(',')}`)) ?? []
    );
  }

  /** Pengurus terdekat kelompok itu (kelompok → desa → daerah). */
  async pengurusKelompok(kelompokId: string): Promise<CoreUser[]> {
    return (
      (await this.get<CoreUser[]>(`/kelompok/${encodeURIComponent(kelompokId)}/pengurus`)) ?? []
    );
  }

  userByWa(noWa: string): Promise<CoreUser | null> {
    return this.get<CoreUser>(`/users/by-wa/${encodeURIComponent(noWa)}`);
  }

  async anggota(updatedSince?: Date): Promise<EventPayload<'anggota.upserted'>[]> {
    const q = updatedSince ? `?updatedSince=${encodeURIComponent(updatedSince.toISOString())}` : '';
    return (await this.get<EventPayload<'anggota.upserted'>[]>(`/anggota${q}`)) ?? [];
  }
}
