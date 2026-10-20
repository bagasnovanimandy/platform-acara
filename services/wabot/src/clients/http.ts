import { HttpStatus } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { config } from '../config.js';

/** GET /internal/* ke service lain dengan header x-internal-key. `null` bila 404. */
export async function internalGet<T>(
  base: string,
  service: string,
  path: string,
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(new URL(`/internal${path}`, base), {
      headers: { 'x-internal-key': config().INTERNAL_KEY ?? '' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(
      HttpStatus.BAD_GATEWAY,
      'UPSTREAM_UNAVAILABLE',
      `${service} tidak bisa dihubungi`,
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new AppError(
      HttpStatus.BAD_GATEWAY,
      'UPSTREAM_ERROR',
      `${service} membalas ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

/** Cache sederhana berbasis waktu; janji yang gagal tidak disimpan. */
export class TtlCache<T> {
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
