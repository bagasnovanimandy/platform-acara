import { useAuth } from './auth';

/** Lewat rewrite Next (/api/core → core-svc) supaya cookie refresh satu origin. */
export const CORE = '/api/core';
/** Lewat rewrite Next (/api/acara → acara-svc). Token tetap dari core. */
export const ACARA = '/api/acara';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { code?: string; message?: string; details?: unknown };
    return new ApiError(
      res.status,
      body.code ?? 'ERROR',
      body.message ?? res.statusText,
      body.details,
    );
  } catch {
    return new ApiError(res.status, 'ERROR', res.statusText || 'Terjadi kesalahan');
  }
}

let refreshing: Promise<boolean> | null = null;

/** Minta access token baru memakai cookie refresh. Satu permintaan untuk banyak pemanggil. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${CORE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        useAuth.getState().clear();
        return false;
      }
      const data = (await res.json()) as { accessToken: string; user: AuthUser };
      useAuth.getState().setSession(data.accessToken, data.user);
      return true;
    } catch {
      useAuth.getState().clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'PENGURUS' | 'AUDITOR';

export interface AuthUser {
  id: string;
  role: Role;
  nama: string;
  email: string;
}

type Body = Record<string, unknown> | FormData | undefined;

async function raw(
  path: string,
  init: { method?: string; body?: Body; base?: string; signal?: AbortSignal } = {},
  retry = true,
): Promise<Response> {
  const token = useAuth.getState().accessToken;
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) body = init.body;
  else if (init.body) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const res = await fetch(`${init.base ?? CORE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
    signal: init.signal,
  });
  if (res.status === 401 && retry && (await refreshSession())) return raw(path, init, false);
  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: Body; base?: string } = {},
): Promise<T> {
  const res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiBlob(path: string, base = CORE): Promise<Blob> {
  return (await raw(path, { base })).blob();
}

/** Respons mentah (mis. stream SSE) dengan token & refresh otomatis. */
export function apiStream(path: string, base: string, signal: AbortSignal): Promise<Response> {
  return raw(path, { base, signal });
}

/** Seperti `api`, tetapi ke acara-svc. */
export function acaraApi<T>(path: string, init: { method?: string; body?: Body } = {}) {
  return api<T>(path, { ...init, base: ACARA });
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${CORE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!res.ok) throw await toError(res);
  const data = (await res.json()) as { accessToken: string; user: AuthUser };
  useAuth.getState().setSession(data.accessToken, data.user);
}

export async function logout(): Promise<void> {
  await fetch(`${CORE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(
    () => undefined,
  );
  useAuth.getState().clear();
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      return (err.details as { path: string; message: string }[])
        .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
        .join('; ');
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Terjadi kesalahan';
}
