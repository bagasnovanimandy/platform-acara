import { describe, expect, it } from 'vitest';
import type { WilayahTree } from '../scope/scope.js';
import { isPeserta, penyelenggara, pesertaWhere, validateTingkat } from './peserta.js';

const tree: WilayahTree = {
  daerah: [
    { id: 'r1', kode: 'R1', nama: 'Daerah 1' },
    { id: 'r2', kode: 'R2', nama: 'Daerah 2' },
  ],
  desa: [
    { id: 'd1', kode: 'D1', nama: 'Desa 1', daerahId: 'r1' },
    { id: 'd2', kode: 'D2', nama: 'Desa 2', daerahId: 'r1' },
    { id: 'd3', kode: 'D3', nama: 'Desa 3', daerahId: 'r2' },
  ],
  kelompok: [
    { id: 'k1', kode: 'K1', nama: 'K 1', desaId: 'd1' },
    { id: 'k2', kode: 'K2', nama: 'K 2', desaId: 'd1' },
    { id: 'k3', kode: 'K3', nama: 'K 3', desaId: 'd2' },
    { id: 'k4', kode: 'K4', nama: 'K 4', desaId: 'd3' },
  ],
};

describe('penyelenggara', () => {
  it('kelompok dalam satu desa → desa', () => {
    expect(
      penyelenggara(
        [
          { level: 'KELOMPOK', id: 'k1' },
          { level: 'KELOMPOK', id: 'k2' },
        ],
        tree,
      ),
    ).toEqual({ level: 'DESA', id: 'd1' });
  });

  it('kelompok lintas desa → daerah; satu wilayah → dirinya', () => {
    expect(
      penyelenggara(
        [
          { level: 'KELOMPOK', id: 'k1' },
          { level: 'DESA', id: 'd2' },
        ],
        tree,
      ),
    ).toEqual({ level: 'DAERAH', id: 'r1' });
    expect(penyelenggara([{ level: 'KELOMPOK', id: 'k3' }], tree)).toEqual({
      level: 'KELOMPOK',
      id: 'k3',
    });
  });

  it('lintas daerah atau wilayah tidak dikenal → null', () => {
    expect(
      penyelenggara(
        [
          { level: 'KELOMPOK', id: 'k1' },
          { level: 'KELOMPOK', id: 'k4' },
        ],
        tree,
      ),
    ).toBeNull();
    expect(penyelenggara([{ level: 'KELOMPOK', id: 'x' }], tree)).toBeNull();
  });
});

describe('validateTingkat', () => {
  it('tingkat tunggal butuh tepat satu wilayah di level itu', () => {
    expect(validateTingkat('DESA', [{ level: 'DESA', id: 'd1' }])).toBeNull();
    expect(validateTingkat('DESA', [{ level: 'KELOMPOK', id: 'k1' }])).not.toBeNull();
    expect(validateTingkat('GABUNGAN', [{ level: 'KELOMPOK', id: 'k1' }])).not.toBeNull();
    expect(
      validateTingkat('GABUNGAN', [
        { level: 'KELOMPOK', id: 'k1' },
        { level: 'KELOMPOK', id: 'k3' },
      ]),
    ).toBeNull();
  });
});

describe('peserta', () => {
  const rules = [
    { level: 'DESA', refId: 'd1', jenisKelamin: null, kategori: ['REMAJA', 'USIA_NIKAH'] },
    { level: 'KELOMPOK', refId: 'k3', jenisKelamin: 'P', kategori: [] },
  ];
  const base = {
    status: 'AKTIF',
    jenisKelamin: 'L',
    kelompokId: 'k1',
    desaId: 'd1',
    daerahId: 'r1',
    kategori: ['REMAJA'],
  };

  it('cocok wilayah, kategori, jenis kelamin, status', () => {
    expect(isPeserta(base, rules)).toBe(true);
    expect(isPeserta({ ...base, kategori: ['CABERAWIT'] }, rules)).toBe(false);
    expect(isPeserta({ ...base, status: 'NONAKTIF' }, rules)).toBe(false);
    const k3 = { ...base, kelompokId: 'k3', desaId: 'd2', kategori: [] };
    expect(isPeserta(k3, rules)).toBe(false);
    expect(isPeserta({ ...k3, jenisKelamin: 'P' }, rules)).toBe(true);
  });

  it('filter Prisma setara', () => {
    expect(pesertaWhere(rules)).toEqual({
      status: 'AKTIF',
      OR: [
        { desaId: 'd1', kategori: { hasSome: ['REMAJA', 'USIA_NIKAH'] } },
        { kelompokId: 'k3', jenisKelamin: 'P' },
      ],
    });
    expect(pesertaWhere([])).toEqual({ id: { in: [] } });
  });
});
