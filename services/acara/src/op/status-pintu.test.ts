import { describe, expect, it } from 'vitest';
import { statusPintu } from './status-pintu.js';

const now = new Date('2026-10-19T08:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('statusPintu', () => {
  it('dicabut mengalahkan semua status lain', () => {
    expect(
      statusPintu({ lastSeenAt: ago(1000), lastScanAt: ago(1000), revokedAt: ago(5) }, now),
    ).toBe('DICABUT');
  });
  it('belum pernah terhubung', () => {
    expect(statusPintu({ lastSeenAt: null, lastScanAt: null, revokedAt: null }, now)).toBe(
      'BELUM_LOGIN',
    );
  });
  it('online bila heartbeat < 45 dtk dan scan < 5 menit', () => {
    expect(
      statusPintu({ lastSeenAt: ago(44_000), lastScanAt: ago(60_000), revokedAt: null }, now),
    ).toBe('ONLINE');
  });
  it('idle bila online tapi belum scan 5 menit atau belum pernah scan', () => {
    expect(
      statusPintu({ lastSeenAt: ago(1000), lastScanAt: ago(301_000), revokedAt: null }, now),
    ).toBe('IDLE');
    expect(statusPintu({ lastSeenAt: ago(1000), lastScanAt: null, revokedAt: null }, now)).toBe(
      'IDLE',
    );
  });
  it('offline bila heartbeat terakhir ≥ 45 dtk', () => {
    expect(
      statusPintu({ lastSeenAt: ago(45_000), lastScanAt: ago(1000), revokedAt: null }, now),
    ).toBe('OFFLINE');
  });
});
