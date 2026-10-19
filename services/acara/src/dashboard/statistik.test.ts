import { describe, expect, it } from 'vitest';
import { type AcaraRow, bulanWib, rentangBulan, statistikAcara } from './statistik.js';

const row = (p: Partial<AcaraRow>): AcaraRow => ({
  id: 'a',
  nama: 'Acara',
  status: 'TERJADWAL',
  tingkat: 'DESA',
  lokasi: null,
  tanggalMulai: new Date('2026-10-20T01:00:00Z'),
  tanggalSelesai: new Date('2026-10-20T04:00:00Z'),
  jumlahSesi: 1,
  ...p,
});

describe('statistikAcara', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  it('bulan dihitung dalam WIB', () => {
    expect(bulanWib(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11');
    expect(rentangBulan(now, 1, 1)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('menghitung status, tingkat, sesi, bulan ini dan per bulan', () => {
    const s = statistikAcara(
      [
        row({ id: '1' }),
        row({
          id: '2',
          tingkat: 'GABUNGAN',
          jumlahSesi: 2,
          tanggalMulai: new Date('2026-12-01T01:00:00Z'),
          tanggalSelesai: new Date('2026-12-01T03:00:00Z'),
        }),
        row({ id: '3', status: 'BATAL' }),
        row({
          id: '4',
          status: 'SELESAI',
          tanggalMulai: new Date('2026-08-01T01:00:00Z'),
          tanggalSelesai: new Date('2026-08-01T03:00:00Z'),
        }),
      ],
      now,
    );
    expect(s.total).toBe(4);
    expect(s.sesi).toBe(5);
    expect(s.status.BATAL).toBe(1);
    expect(s.tingkat.GABUNGAN).toBe(1);
    expect(s.bulanIni).toBe(1);
    expect(s.perBulan).toHaveLength(12);
    expect(s.perBulan.find((b) => b.bulan === '2026-08')).toEqual({
      bulan: '2026-08',
      jumlah: 1,
      lewat: true,
    });
    expect(s.perBulan.find((b) => b.bulan === '2026-10')?.jumlah).toBe(1);
    expect(s.akanDatang).toBe(2);
    expect(s.terdekat.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('acara yang sedang berlangsung masih terhitung akan datang', () => {
    const s = statistikAcara(
      [
        row({
          tanggalMulai: new Date('2026-10-19T10:00:00Z'),
          tanggalSelesai: new Date('2026-10-19T14:00:00Z'),
        }),
      ],
      now,
    );
    expect(s.akanDatang).toBe(1);
  });
});
