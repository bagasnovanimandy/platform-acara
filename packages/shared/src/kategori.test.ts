import { describe, expect, it } from 'vitest';
import { parseKategori } from './kategori.js';

describe('parseKategori', () => {
  it.each([
    ['Caberawit', 'CABERAWIT'],
    ['cabe rawit', 'CABERAWIT'],
    ['Pra Remaja', 'PRAREMAJA'],
    ['pra-remaja', 'PRAREMAJA'],
    ['REMAJA', 'REMAJA'],
    ['Usia Nikah', 'USIA_NIKAH'],
    ['usia_nikah', 'USIA_NIKAH'],
  ])('%s → %s', (input, expected) => {
    expect(parseKategori(input)).toBe(expected);
  });

  it('tidak mengenali teks lain', () => {
    expect(parseKategori('dewasa')).toBeNull();
    expect(parseKategori('')).toBeNull();
  });
});
