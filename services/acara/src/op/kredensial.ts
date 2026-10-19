import { randomBytes, randomInt } from 'node:crypto';

// Tanpa huruf/angka yang mirip (0/O, 1/I/L) agar mudah diketik dari kartu.
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kode pintu 6 karakter untuk login PIN. */
export function buatKode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABET[randomInt(ALFABET.length)];
  return s;
}

/** PIN 6 digit. */
export function buatPin(): string {
  return String(randomInt(1_000_000)).padStart(6, '0');
}

/** Token QR sekali pakai. */
export function buatQrToken(): string {
  return randomBytes(24).toString('base64url');
}

/** QR berlaku 24 jam sejak dibuat (AGENTS.md). */
export const QR_BERLAKU_MS = 24 * 3600_000;
