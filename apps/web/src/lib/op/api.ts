import type { AntreanItem, HasilBatch, OpSession, Paket } from './types';

const BASE = '/api/acara/op';

export class OpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.body) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let code = 'ERROR';
    let message = res.statusText || 'Terjadi kesalahan';
    try {
      const b = (await res.json()) as { code?: string; message?: string };
      code = b.code ?? code;
      message = b.message ?? message;
    } catch {
      // bukan JSON
    }
    throw new OpError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export function loginOperator(token: string): Promise<OpSession> {
  return req('/login', {
    method: 'POST',
    body: JSON.stringify({ token, perangkat: navigator.userAgent.slice(0, 200) }),
  });
}

export function ambilPaket(s: OpSession): Promise<Paket> {
  return req('/paket', { token: s.token });
}

export function kirimBatch(s: OpSession, items: AntreanItem[]): Promise<HasilBatch> {
  return req('/absensi/batch', {
    method: 'POST',
    token: s.token,
    body: JSON.stringify({ items }),
  });
}
