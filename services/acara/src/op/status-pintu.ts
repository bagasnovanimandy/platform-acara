/** Status perangkat pintu untuk monitoring (HANDOVER §5.7). Fungsi murni. */

export type StatusPintu = 'BELUM_LOGIN' | 'ONLINE' | 'IDLE' | 'OFFLINE' | 'DICABUT';

/** Perangkat dianggap online bila heartbeat terakhir < 45 dtk. */
export const ONLINE_MS = 45_000;
/** Online tanpa scan selama 5 menit = idle. */
export const IDLE_MS = 5 * 60_000;

export interface PintuWaktu {
  lastSeenAt: Date | null;
  lastScanAt: Date | null;
  revokedAt: Date | null;
}

export function statusPintu(p: PintuWaktu, now: Date): StatusPintu {
  if (p.revokedAt) return 'DICABUT';
  if (!p.lastSeenAt) return 'BELUM_LOGIN';
  if (now.getTime() - p.lastSeenAt.getTime() >= ONLINE_MS) return 'OFFLINE';
  if (!p.lastScanAt || now.getTime() - p.lastScanAt.getTime() > IDLE_MS) return 'IDLE';
  return 'ONLINE';
}
