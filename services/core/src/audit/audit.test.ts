import { describe, expect, it } from 'vitest';
import { computeScope } from '../scope/scope.js';
import { auditScopeWhere, diffFields } from './audit.js';

describe('diffFields', () => {
  it('hanya field yang berubah, tanggal jadi ISO', () => {
    const d = new Date('2010-01-02T00:00:00.000Z');
    expect(
      diffFields(
        { nama: 'A', noWa: null, tanggalLahir: d, status: 'AKTIF' },
        { nama: 'B', noWa: null, tanggalLahir: new Date(d), status: undefined },
      ),
    ).toEqual({ nama: ['A', 'B'] });
  });

  it('array dibandingkan isinya', () => {
    expect(diffFields({ kategori: ['REMAJA'] }, { kategori: ['REMAJA', 'IBU_IBU'] })).toEqual({
      kategori: ['["REMAJA"]', '["REMAJA","IBU_IBU"]'],
    });
  });
});

describe('auditScopeWhere', () => {
  const tree = {
    daerah: [{ id: 'r1' }],
    desa: [{ id: 'd1', daerahId: 'r1' }],
    kelompok: [{ id: 'k1', desaId: 'd1' }],
  };

  it('super admin tanpa filter', () => {
    expect(auditScopeWhere(computeScope(true, [], tree))).toBeUndefined();
  });

  it('auditor desa melihat entri kelompok & desanya, bukan entri daerah', () => {
    const where = auditScopeWhere(computeScope(false, [{ level: 'DESA', refId: 'd1' }], tree));
    expect(where).toEqual({
      OR: [
        { kelompokId: { in: ['k1'] } },
        { kelompokId: null, desaId: { in: ['d1'] } },
        { kelompokId: null, desaId: null, daerahId: { in: [] } },
      ],
    });
  });
});
