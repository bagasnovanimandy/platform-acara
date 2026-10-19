import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventsService } from './events.service.js';

process.env.DATABASE_URL ??= 'postgresql://x';

const payload = {
  izinId: 'i1',
  anggotaId: 'a1',
  acaraId: 'c1',
  kategori: 'IZIN' as const,
  alasan: 'acara keluarga',
};

describe('EventsService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('menolak payload yang tidak sesuai schema sebelum menyentuh Redis', async () => {
    const svc = new EventsService();
    await expect(svc.publish('izin.submitted', { ...payload, alasan: '' })).rejects.toThrow();
  });

  it('mengirim ke setiap queue tujuan dengan addBulk', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const svc = new EventsService();
    const addBulk = vi.fn().mockResolvedValue([]);
    vi.spyOn(svc as unknown as { queue: () => unknown }, 'queue').mockReturnValue({ addBulk });
    await svc.publishMany('anggota.mutasi', [
      { anggotaId: 'a1', dariKelompokId: 'k1', keKelompokId: 'k2', tanggal: '2026-10-01' },
      { anggotaId: 'a2', dariKelompokId: 'k1', keKelompokId: 'k2', tanggal: '2026-10-01' },
    ]);
    expect(addBulk).toHaveBeenCalledTimes(1); // anggota.mutasi → hanya acara-events
    expect(addBulk.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('tidak melempar bila Redis gagal', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const svc = new EventsService();
    const addBulk = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(svc as unknown as { queue: () => unknown }, 'queue').mockReturnValue({ addBulk });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(svc.publish('izin.submitted', payload)).resolves.toBeUndefined();
  });
});
