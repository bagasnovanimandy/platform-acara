import { describe, expect, it } from 'vitest';
import { type BarisKehadiran, statistikKehadiran } from './kehadiran.js';

const baris = (p: Partial<BarisKehadiran>): BarisKehadiran => ({
  sesiId: 's1',
  sesiNama: 'Sesi 1',
  acaraId: 'a1',
  acaraNama: 'Pengajian',
  mulai: new Date('2026-10-05T12:00:00Z'),
  status: 'HADIR',
  terlambat: false,
  kategori: [],
  ...p,
});

describe('statistikKehadiran', () => {
  const now = new Date('2026-10-19T00:00:00Z');
  const rows = [
    baris({ kategori: ['REMAJA'] }),
    baris({ status: 'ALPHA', kategori: ['REMAJA', 'USIA_NIKAH'] }),
    baris({ status: 'IZIN' }),
    baris({ sesiId: 's2', sesiNama: 'Sesi 2', mulai: new Date('2026-09-01T12:00:00Z') }),
    baris({ sesiId: 'lama', mulai: new Date('2025-01-01T12:00:00Z') }),
  ];
  const s = statistikKehadiran(rows, now);

  it('ringkasan total dan per bulan 6 bulan terakhir', () => {
    expect(s.ringkas).toMatchObject({ peserta: 5, HADIR: 3, IZIN: 1, ALPHA: 1 });
    expect(s.perBulan.map((b) => b.bulan)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(s.perBulan.at(-1)).toMatchObject({ peserta: 3, HADIR: 1, persenHadir: 33.3 });
    expect(s.perBulan.at(-2)).toMatchObject({ peserta: 1, HADIR: 1 });
  });

  it('per kategori, termasuk yang belum berkategori', () => {
    const k = Object.fromEntries(s.perKategori.map((x) => [x.kode, [x.peserta, x.HADIR]]));
    expect(k).toEqual({ REMAJA: [2, 1], USIA_NIKAH: [1, 0], BELUM: [3, 2] });
  });

  it('sesi terbaru urut waktu', () => {
    expect(s.sesiTerbaru.map((x) => x.id)).toEqual(['s1', 's2', 'lama']);
    expect(s.sesiTerbaru[0]!.ringkas.peserta).toBe(3);
  });
});
