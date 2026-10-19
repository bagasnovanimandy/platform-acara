import type { OpSession } from './types';

const KEY = 'op-session';

export function bacaSesi(): OpSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OpSession;
    return new Date(s.expiresAt) > new Date() ? s : null;
  } catch {
    return null;
  }
}

export function simpanSesi(s: OpSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function hapusSesi(): void {
  localStorage.removeItem(KEY);
}

const KAMERA = 'op-kamera';
export const kameraTersimpan = () => {
  try {
    return localStorage.getItem(KAMERA);
  } catch {
    return null;
  }
};
export const simpanKamera = (id: string) => {
  try {
    localStorage.setItem(KAMERA, id);
  } catch {
    // abaikan (mode privat)
  }
};
