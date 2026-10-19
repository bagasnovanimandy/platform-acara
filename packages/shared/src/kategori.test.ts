import { describe, expect, it } from 'vitest';
import { kodeKategori, kunciKategori } from './kategori.js';

describe('kodeKategori', () => {
  it.each([
    ['Ibu-ibu', 'IBU_IBU'],
    ['Usia nikah', 'USIA_NIKAH'],
    ['  Pra-remaja ', 'PRA_REMAJA'],
    ['Remaja (SMA)', 'REMAJA_SMA'],
  ])('%s → %s', (nama, kode) => {
    expect(kodeKategori(nama)).toBe(kode);
  });
});

describe('kunciKategori', () => {
  it('mengabaikan spasi, tanda hubung, dan huruf besar', () => {
    expect(kunciKategori('Pra Remaja')).toBe(kunciKategori('pra-remaja'));
    expect(kunciKategori('USIA_NIKAH')).toBe(kunciKategori('Usia nikah'));
    expect(kunciKategori('Ibu-ibu')).not.toBe(kunciKategori('Bapak-bapak'));
  });
});
