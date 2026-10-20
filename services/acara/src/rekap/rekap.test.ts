import { describe, expect, it } from 'vitest';
import { hitungRekap, type IzinRekap, perluDitutup, ringkas, ringkasPer } from './rekap.js';

const t = (s: string) => new Date(`2026-10-19T${s}:00Z`);
const izin = (p: Partial<IzinRekap> & Pick<IzinRekap, 'id' | 'anggotaId'>): IzinRekap => ({
  sesiId: null,
  kategori: 'IZIN',
  status: 'APPROVED',
  updatedAt: t('08:00'),
  ...p,
});

describe('hitungRekap', () => {
  it('hadir, izin, sakit, alpha sesuai aturan', () => {
    const rows = hitungRekap(
      's1',
      ['a', 'b', 'c', 'd', 'e', 'f'],
      [
        { id: 'abs-a', anggotaId: 'a', terlambat: false },
        { id: 'abs-b', anggotaId: 'b', terlambat: true },
      ],
      [
        izin({ id: 'iz-a', anggotaId: 'a' }), // hadir menang
        izin({ id: 'iz-c', anggotaId: 'c', sesiId: 's1' }),
        izin({ id: 'iz-d', anggotaId: 'd', kategori: 'SAKIT' }),
        izin({ id: 'iz-e', anggotaId: 'e', status: 'REJECTED' }),
        izin({ id: 'iz-f', anggotaId: 'f', sesiId: 's2' }), // sesi lain
      ],
    );
    expect(rows.map((r) => [r.anggotaId, r.status, r.terlambat])).toEqual([
      ['a', 'HADIR', false],
      ['b', 'HADIR', true],
      ['c', 'IZIN', false],
      ['d', 'SAKIT', false],
      ['e', 'ALPHA', false],
      ['f', 'ALPHA', false],
    ]);
    expect(rows[0]).toMatchObject({ absensiId: 'abs-a', izinId: null });
    expect(rows[3]).toMatchObject({ izinId: 'iz-d' });
  });

  it('izin khusus sesi mengalahkan izin seluruh acara; sesama jenis yang terbaru menang', () => {
    const rows = hitungRekap(
      's1',
      ['a', 'b'],
      [],
      [
        izin({ id: 'semua', anggotaId: 'a', kategori: 'IZIN', updatedAt: t('10:00') }),
        izin({
          id: 'khusus',
          anggotaId: 'a',
          sesiId: 's1',
          kategori: 'SAKIT',
          updatedAt: t('09:00'),
        }),
        izin({ id: 'lama', anggotaId: 'b', kategori: 'IZIN', updatedAt: t('08:00') }),
        izin({ id: 'baru', anggotaId: 'b', kategori: 'SAKIT', updatedAt: t('09:00') }),
      ],
    );
    expect(rows.map((r) => [r.status, r.izinId])).toEqual([
      ['SAKIT', 'khusus'],
      ['SAKIT', 'baru'],
    ]);
  });

  it('peserta ganda dihitung sekali', () => {
    expect(hitungRekap('s1', ['a', 'a'], [], [])).toHaveLength(1);
  });
});

describe('ringkas', () => {
  it('menghitung jumlah per status dan persen hadir', () => {
    const r = ringkas([
      { status: 'HADIR', terlambat: true },
      { status: 'HADIR', terlambat: false },
      { status: 'IZIN', terlambat: false },
    ]);
    expect(r).toEqual({
      peserta: 3,
      HADIR: 2,
      IZIN: 1,
      SAKIT: 0,
      ALPHA: 0,
      terlambat: 1,
      persenHadir: 66.7,
    });
    expect(ringkas([]).persenHadir).toBe(0);
  });

  it('ringkasPer mengelompokkan dan mengurutkan nama', () => {
    const per = ringkasPer(
      [
        { status: 'HADIR' as const, terlambat: false, k: 'k2' },
        { status: 'ALPHA' as const, terlambat: false, k: 'k1' },
        { status: 'HADIR' as const, terlambat: false, k: 'k1' },
      ],
      (r) => ({ id: r.k, nama: r.k === 'k1' ? 'Anggrek' : 'Mawar' }),
    );
    expect(per.map((p) => [p.nama, p.peserta, p.HADIR])).toEqual([
      ['Anggrek', 2, 1],
      ['Mawar', 1, 1],
    ]);
  });
});

describe('perluDitutup', () => {
  it('lewat selesai + 2 jam dan belum ditutup', () => {
    const selesai = t('10:00');
    expect(perluDitutup({ selesai, ditutupAt: null }, t('11:59'))).toBe(false);
    expect(perluDitutup({ selesai, ditutupAt: null }, t('12:00'))).toBe(true);
    expect(perluDitutup({ selesai, ditutupAt: t('10:30') }, t('13:00'))).toBe(false);
  });
});
