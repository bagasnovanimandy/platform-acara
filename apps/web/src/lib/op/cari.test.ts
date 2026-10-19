import { describe, expect, it } from 'vitest';
import { cariPeserta, normal } from './cari';

const list = [
  { kode: 'JS-0001', nama: 'Ahmad Fauzi' },
  { kode: 'JS-0002', nama: 'Siti Aisyah' },
  { kode: 'JS-0010', nama: 'Muhammad Fauzan' },
  { kode: 'JU-0001', nama: 'Fatimah Hidayat' },
];

describe('cariPeserta', () => {
  it('normalisasi huruf & tanda', () => {
    expect(normal('  Áhmad-Fauzi ')).toBe('ahmad fauzi');
  });

  it('kode persis paling atas, awalan kode juga cocok', () => {
    expect(cariPeserta(list, 'js-0001')[0]?.nama).toBe('Ahmad Fauzi');
    expect(cariPeserta(list, 'JS-00').length).toBe(3);
  });

  it('awalan kata & beberapa kata', () => {
    expect(cariPeserta(list, 'fauz').map((p) => p.nama)).toEqual([
      'Ahmad Fauzi',
      'Muhammad Fauzan',
    ]);
    expect(cariPeserta(list, 'ahm fau').map((p) => p.nama)).toEqual(['Ahmad Fauzi']);
  });

  it('toleran satu salah ketik', () => {
    expect(cariPeserta(list, 'fatimha').map((p) => p.nama)).toEqual(['Fatimah Hidayat']);
  });

  it('kosong / tidak cocok', () => {
    expect(cariPeserta(list, '')).toEqual([]);
    expect(cariPeserta(list, 'zzz')).toEqual([]);
  });
});
