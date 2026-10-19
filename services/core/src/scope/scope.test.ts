import { describe, expect, it } from 'vitest';
import {
  canManageDesa,
  canManageKelompok,
  canSeeDaerah,
  canSeeDesa,
  computeScope,
  kelompokFilter,
  type WilayahTree,
} from './scope.js';

const tree: WilayahTree = {
  daerah: [{ id: 'D1' }, { id: 'D2' }],
  desa: [
    { id: 'S1', daerahId: 'D1' },
    { id: 'S2', daerahId: 'D1' },
    { id: 'S3', daerahId: 'D2' },
  ],
  kelompok: [
    { id: 'K1', desaId: 'S1' },
    { id: 'K2', desaId: 'S1' },
    { id: 'K3', desaId: 'S2' },
    { id: 'K4', desaId: 'S3' },
  ],
};

describe('computeScope', () => {
  it('SUPER_ADMIN melihat dan mengelola semua', () => {
    const s = computeScope(true, [], tree);
    expect(s.all).toBe(true);
    expect(canManageKelompok(s, 'K4')).toBe(true);
    expect(kelompokFilter(s)).toBeUndefined();
  });

  it('scope DAERAH mencakup semua desa dan kelompok di bawahnya', () => {
    const s = computeScope(false, [{ level: 'DAERAH', refId: 'D1' }], tree);
    expect([...s.manageKelompok].sort()).toEqual(['K1', 'K2', 'K3']);
    expect(canManageDesa(s, 'S2')).toBe(true);
    expect(canManageKelompok(s, 'K4')).toBe(false);
  });

  it('scope DESA tidak bisa mengelola desa tetangga, tapi melihat daerah induk', () => {
    const s = computeScope(false, [{ level: 'DESA', refId: 'S1' }], tree);
    expect(kelompokFilter(s)).toEqual({ in: ['K1', 'K2'] });
    expect(canManageDesa(s, 'S2')).toBe(false);
    expect(canSeeDaerah(s, 'D1')).toBe(true);
    expect(canSeeDaerah(s, 'D2')).toBe(false);
  });

  it('scope KELOMPOK hanya kelompok itu; desa & daerah induk terlihat', () => {
    const s = computeScope(false, [{ level: 'KELOMPOK', refId: 'K3' }], tree);
    expect([...s.manageKelompok]).toEqual(['K3']);
    expect(canManageDesa(s, 'S2')).toBe(false);
    expect(canSeeDesa(s, 'S2')).toBe(true);
    expect(canSeeDesa(s, 'S1')).toBe(false);
    expect(canSeeDaerah(s, 'D1')).toBe(true);
  });

  it('beberapa scope digabung', () => {
    const s = computeScope(
      false,
      [
        { level: 'KELOMPOK', refId: 'K1' },
        { level: 'DESA', refId: 'S3' },
      ],
      tree,
    );
    expect([...s.manageKelompok].sort()).toEqual(['K1', 'K4']);
  });

  it('tanpa scope = tidak melihat apa pun', () => {
    const s = computeScope(false, [], tree);
    expect(kelompokFilter(s)).toEqual({ in: [] });
    expect(canSeeDaerah(s, 'D1')).toBe(false);
  });
});
