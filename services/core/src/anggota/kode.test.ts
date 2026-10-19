import { describe, expect, it } from 'vitest';
import { formatKodeAnggota } from './kode.js';

describe('formatKodeAnggota', () => {
  it('menambah nol di depan sampai 4 digit', () => {
    expect(formatKodeAnggota('JS', 1)).toBe('JS-0001');
    expect(formatKodeAnggota('JS', 123)).toBe('JS-0123');
  });
  it('tidak memotong nomor di atas 9999', () => {
    expect(formatKodeAnggota('JS', 12345)).toBe('JS-12345');
  });
});
