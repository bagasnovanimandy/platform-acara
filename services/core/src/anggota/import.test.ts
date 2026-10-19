import { describe, expect, it } from 'vitest';
import {
  type ImportContext,
  parseTanggal,
  type RawRow,
  validateImportRows,
  type WilayahRef,
  wilayahKey,
} from './import.js';

const k1: WilayahRef = {
  kelompokId: 'K1',
  kelompok: 'Kelompok Satu',
  desaId: 'S1',
  desa: 'Desa Selatan',
  kodeDesa: 'JS',
  daerahId: 'R1',
  daerah: 'Daerah Contoh',
};
const k2: WilayahRef = { ...k1, kelompokId: 'K2', kelompok: 'Kelompok Dua' };

const ctx: ImportContext = {
  wilayah: new Map([
    [wilayahKey(k1.daerah, k1.desa, k1.kelompok), k1],
    [wilayahKey(k2.daerah, k2.desa, k2.kelompok), k2],
  ]),
  canManageKelompok: (id) => id === 'K1',
  existingNoWa: new Set(['6281111111111']),
  kategori: new Map(
    [
      { id: 'KT1', kode: 'PRAREMAJA', nama: 'Pra-remaja', warna: 'sky' },
      { id: 'KT2', kode: 'IBU_IBU', nama: 'Ibu-ibu', warna: 'rose' },
    ].map((k) => [k.id, k]),
  ),
};

const base: RawRow = {
  Nama: 'Ahmad Fauzi',
  JK: 'L',
  'Tgl Lahir': '05/03/2010',
  Kategori: 'Pra Remaja, ibu ibu',
  'No WA': '0812 3456 7890',
  'No WA Ortu': '+62 813-0000-1111',
  'Nama Ortu': 'Pak Budi',
  Kelompok: 'kelompok satu',
  Desa: '  Desa  Selatan ',
  Daerah: 'DAERAH CONTOH',
};

describe('validateImportRows', () => {
  it('menerima baris valid, menormalisasi WA, dan mencocokkan wilayah tanpa peka huruf', () => {
    const { valid, errors } = validateImportRows([base], ctx);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({
      baris: 2,
      nama: 'Ahmad Fauzi',
      jenisKelamin: 'L',
      tanggalLahir: '2010-03-05',
      kategoriIds: ['KT1', 'KT2'],
      noWa: '6281234567890',
      noWaOrtu: '6281300001111',
      namaOrtu: 'Pak Budi',
      wilayah: { kelompokId: 'K1' },
    });
  });

  it('melaporkan semua kesalahan per baris dengan nomor baris Excel', () => {
    const { valid, errors } = validateImportRows(
      [
        base,
        {
          ...base,
          Nama: '',
          JK: 'X',
          'Tgl Lahir': '31/02/2010',
          Kategori: 'Dewasa',
          'No WA': '12345',
        },
      ],
      ctx,
    );
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([
      {
        baris: 3,
        nama: '(kosong)',
        pesan: [
          'Nama wajib diisi',
          'JK harus L atau P',
          'Tgl Lahir tidak valid (pakai dd/mm/yyyy)',
          'Kategori "Dewasa" tidak dikenal',
          'No WA tidak valid',
        ],
      },
    ]);
  });

  it('menolak wilayah yang tidak ada atau di luar scope', () => {
    const { errors } = validateImportRows(
      [
        { ...base, 'No WA': '', Kelompok: 'Kelompok Tiga' },
        { ...base, 'No WA': '', Kelompok: 'Kelompok Dua' },
        { ...base, 'No WA': '', Daerah: '' },
      ],
      ctx,
    );
    expect(errors.map((e) => e.pesan[0])).toEqual([
      'Wilayah "Kelompok Tiga / Desa  Selatan / DAERAH CONTOH" tidak ditemukan',
      'Kelompok di luar wilayah Anda',
      'Kelompok, Desa, dan Daerah wajib diisi',
    ]);
  });

  it('menolak No WA yang sudah terdaftar atau dobel di file', () => {
    const { valid, errors } = validateImportRows(
      [
        { ...base, 'No WA': '081111111111' },
        { ...base, 'No WA': '0899 0000 0001' },
        { ...base, 'No WA': '6289900000001' },
      ],
      ctx,
    );
    expect(valid.map((v) => v.baris)).toEqual([3]);
    expect(errors.map((e) => e.pesan[0])).toEqual([
      'No WA 6281111111111 sudah dipakai anggota lain',
      'No WA 6289900000001 sama dengan baris 3',
    ]);
  });

  it('kolom opsional boleh kosong; JK menerima variasi teks', () => {
    const { valid } = validateImportRows(
      [{ Nama: 'Siti', JK: 'Perempuan', Kelompok: k1.kelompok, Desa: k1.desa, Daerah: k1.daerah }],
      ctx,
    );
    expect(valid[0]).toMatchObject({
      jenisKelamin: 'P',
      tanggalLahir: null,
      kategoriIds: [],
      noWa: null,
      noWaOrtu: null,
    });
  });
});

describe('parseTanggal', () => {
  it.each<[Parameters<typeof parseTanggal>[0], string | null]>([
    ['2010-03-05', '2010-03-05'],
    ['5-3-2010', '2010-03-05'],
    ['05.03.2010', '2010-03-05'],
    [new Date(Date.UTC(2010, 2, 5)), '2010-03-05'],
    [40242, '2010-03-05'],
    ['', null],
    [null, null],
  ])('%s → %s', (input, expected) => {
    expect(parseTanggal(input)).toBe(expected);
  });

  it.each(['31/02/2010', '2010/03/05', 'kemarin', '01/01/1800', '01/01/2999'])(
    'menolak %s',
    (v) => {
      expect(parseTanggal(v)).toBe('invalid');
    },
  );
});
