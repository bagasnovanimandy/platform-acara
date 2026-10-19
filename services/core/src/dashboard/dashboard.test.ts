import { describe, expect, it } from 'vitest';
import {
  aktivitas,
  type AnggotaRow,
  bulanWib,
  daftarBulan,
  grupAksi,
  hariWib,
  ringkasan,
} from './dashboard.js';

const now = new Date('2026-10-19T03:00:00Z'); // 10.00 WIB

const a = (over: Partial<AnggotaRow>): AnggotaRow => ({
  status: 'AKTIF',
  jenisKelamin: 'L',
  kelompokId: 'k1',
  noWa: null,
  tanggalLahir: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  jumlahKategori: 0,
  jumlahWali: 0,
  ...over,
});

const kelompok = [
  { id: 'k1', nama: 'Melati', desaId: 'd1', namaDesa: 'Selatan' },
  { id: 'k2', nama: 'Mawar', desaId: 'd1', namaDesa: 'Selatan' },
  { id: 'k3', nama: 'Anggrek', desaId: 'd2', namaDesa: 'Utara' },
];

describe('waktu WIB', () => {
  it('17.30 UTC tanggal 31 sudah bulan/hari berikutnya di WIB', () => {
    const d = new Date('2026-08-31T17:30:00Z');
    expect(bulanWib(d)).toBe('2026-09');
    expect(hariWib(d)).toBe('2026-09-01');
  });

  it('12 bulan terakhir melewati pergantian tahun', () => {
    const b = daftarBulan(now, 12);
    expect(b).toHaveLength(12);
    expect(b[0]).toBe('2025-11');
    expect(b[11]).toBe('2026-10');
  });
});

describe('ringkasan', () => {
  const r = ringkasan({
    anggota: [
      a({ jumlahKategori: 2, noWa: '6281', tanggalLahir: new Date('2010-01-01') }),
      a({ jenisKelamin: 'P', kelompokId: 'k3', jumlahWali: 1 }),
      a({
        jenisKelamin: 'P',
        kelompokId: 'k3',
        jumlahKategori: 1,
        createdAt: new Date('2025-01-01'),
      }),
      a({ status: 'NONAKTIF', jumlahKategori: 1, noWa: '6282' }),
    ],
    kelompok,
    kategori: [
      { id: 'c2', nama: 'Remaja', warna: 'emerald', urutan: 30, aktif: true },
      { id: 'c1', nama: 'Caberawit', warna: 'amber', urutan: 10, aktif: true },
      { id: 'c3', nama: 'Lama', warna: 'slate', urutan: 5, aktif: false },
    ],
    jumlahPerKategori: new Map([['c2', 2]]),
    mutasi: [
      { tanggal: new Date('2026-10-02'), dariKelompokId: 'k1', keKelompokId: 'k2' },
      { tanggal: new Date('2026-10-03'), dariKelompokId: 'luar', keKelompokId: 'k1' },
      { tanggal: new Date('2026-09-03'), dariKelompokId: 'k3', keKelompokId: 'luar' },
      { tanggal: new Date('2024-01-01'), dariKelompokId: 'k3', keKelompokId: 'luar' },
    ],
    kelompokScope: new Set(['k1', 'k2', 'k3']),
    now,
  });

  it('total, status, dan jenis kelamin (aktif saja)', () => {
    expect(r.total).toBe(4);
    expect(r.aktif).toBe(3);
    expect(r.status).toEqual({ AKTIF: 3, PINDAH: 0, NONAKTIF: 1 });
    expect(r.jenisKelamin).toEqual({ L: 1, P: 2 });
  });

  it('kelengkapan: kontak dihitung dari No WA anggota atau wali', () => {
    expect(r.tanpaKategori).toBe(1);
    expect(r.kelengkapan.kategori).toBeCloseTo(2 / 3);
    expect(r.kelengkapan.kontak).toBeCloseTo(2 / 3);
    expect(r.kelengkapan.tanggalLahir).toBeCloseTo(1 / 3);
  });

  it('wilayah memuat kelompok kosong dan urut terbanyak', () => {
    expect(r.wilayah.map((d) => [d.nama, d.jumlah])).toEqual([
      ['Utara', 2],
      ['Selatan', 1],
    ]);
    expect(r.wilayah[1]!.kelompok.map((k) => [k.nama, k.jumlah])).toEqual([
      ['Melati', 1],
      ['Mawar', 0],
    ]);
  });

  it('kategori urut sesuai urutan, nonaktif tanpa anggota disembunyikan', () => {
    expect(r.kategori.map((k) => [k.nama, k.jumlah])).toEqual([
      ['Caberawit', 0],
      ['Remaja', 2],
    ]);
  });

  it('pertumbuhan & mutasi per bulan (masuk / keluar / dalam wilayah)', () => {
    expect(r.pertumbuhan.at(-1)).toEqual({
      bulan: '2026-10',
      baru: 3,
      masuk: 1,
      keluar: 0,
      dalam: 1,
    });
    expect(r.pertumbuhan.at(-2)).toMatchObject({ bulan: '2026-09', keluar: 1 });
    // anggota 2025-01 di luar 12 bulan terakhir
    expect(r.pertumbuhan.reduce((s, b) => s + b.baru, 0)).toBe(3);
  });

  it('super admin (scope null): semua mutasi dihitung di dalam', () => {
    const all = ringkasan({
      anggota: [],
      kelompok: [],
      kategori: [],
      jumlahPerKategori: new Map(),
      mutasi: [{ tanggal: new Date('2026-10-02'), dariKelompokId: 'x', keKelompokId: 'y' }],
      kelompokScope: null,
      now,
    });
    expect(all.pertumbuhan.at(-1)).toMatchObject({ dalam: 1, masuk: 0, keluar: 0 });
    expect(all.kelengkapan.kategori).toBe(0);
  });
});

describe('aktivitas audit', () => {
  it('grup aksi', () => {
    expect(['CREATE', 'IMPORT', 'UPDATE', 'MUTASI', 'MUTASI_MASUK', 'WALI'].map(grupAksi)).toEqual([
      'tambah',
      'tambah',
      'ubah',
      'pindah',
      'pindah',
      'wali',
    ]);
  });

  it('per hari 30 hari, pelaku teratas, per entitas', () => {
    const row = (aksi: string, userNama: string, createdAt: string, entitas = 'Anggota') => ({
      aksi,
      entitas,
      userId: userNama,
      userNama,
      createdAt: new Date(createdAt),
    });
    const r = aktivitas(
      [
        row('CREATE', 'Ani', '2026-10-19T01:00:00Z'),
        row('UPDATE', 'Ani', '2026-10-18T20:00:00Z'), // 19 Okt WIB
        row('MUTASI_MASUK', 'Budi', '2026-10-10T01:00:00Z', 'Kelompok'),
        row('UPDATE', 'Budi', '2026-08-01T01:00:00Z'), // di luar 30 hari
      ],
      now,
    );
    expect(r.perHari).toHaveLength(30);
    expect(r.perHari.at(-1)).toEqual({
      hari: '2026-10-19',
      tambah: 1,
      ubah: 1,
      pindah: 0,
      wali: 0,
    });
    expect(r.total).toBe(3);
    expect(r.pelaku).toEqual([
      { id: 'Ani', nama: 'Ani', jumlah: 2 },
      { id: 'Budi', nama: 'Budi', jumlah: 1 },
    ]);
    expect(r.entitas).toEqual([
      { nama: 'Anggota', jumlah: 2 },
      { nama: 'Kelompok', jumlah: 1 },
    ]);
  });
});
