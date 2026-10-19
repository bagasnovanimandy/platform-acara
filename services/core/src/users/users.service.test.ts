import { describe, expect, it } from 'vitest';
import { computeScope } from '../scope/scope.js';
import { scopesWithin } from './users.service.js';

const tree = {
  daerah: [{ id: 'r1' }, { id: 'r2' }],
  desa: [
    { id: 'd1', daerahId: 'r1' },
    { id: 'd2', daerahId: 'r1' },
  ],
  kelompok: [
    { id: 'k1', desaId: 'd1' },
    { id: 'k2', desaId: 'd2' },
  ],
};

describe('scopesWithin (admin bertingkat)', () => {
  const adminDaerah = computeScope(false, [{ level: 'DAERAH', refId: 'r1' }], tree);
  const adminDesa = computeScope(false, [{ level: 'DESA', refId: 'd1' }], tree);

  it('admin daerah boleh memberi wilayah desa & kelompok di bawahnya', () => {
    expect(
      scopesWithin(adminDaerah, [
        { level: 'DESA', refId: 'd2' },
        { level: 'KELOMPOK', refId: 'k1' },
      ]),
    ).toBe(true);
    expect(scopesWithin(adminDaerah, [{ level: 'DAERAH', refId: 'r1' }])).toBe(true);
  });

  it('admin desa tidak boleh memberi wilayah desa lain atau daerah', () => {
    expect(scopesWithin(adminDesa, [{ level: 'KELOMPOK', refId: 'k1' }])).toBe(true);
    expect(scopesWithin(adminDesa, [{ level: 'KELOMPOK', refId: 'k2' }])).toBe(false);
    expect(scopesWithin(adminDesa, [{ level: 'DAERAH', refId: 'r1' }])).toBe(false);
  });
});
