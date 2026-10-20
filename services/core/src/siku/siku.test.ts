import { describe, expect, it } from 'vitest';
import { rencanakanImpor, type BarisImpor } from './siku.js';

const b = (email: string, sikuRoles: string[], aktif = true): BarisImpor => ({
  email,
  nama: email,
  sikuRoles,
  aktif,
});

describe('rencanakanImpor', () => {
  const ada = new Map([
    ['lama@x.id', { id: 'u1', sikuRoles: ['bendahara'] }],
    ['admin@x.id', { id: 'u2', sikuRoles: [] }],
  ]);

  it('membuat user baru yang aktif & punya peran', () => {
    const [r] = rencanakanImpor([b('baru@x.id', ['ketua', 'ketua'])], ada);
    expect(r).toMatchObject({ aksi: 'BUAT', baris: { sikuRoles: ['ketua'] } });
  });

  it('mengganti peran user yang sudah ada, tidak membuat duplikat', () => {
    const [r] = rencanakanImpor([b('admin@x.id', ['auditor'])], ada);
    expect(r).toMatchObject({ aksi: 'PERBARUI', id: 'u2', sikuRoles: ['auditor'], sebelum: [] });
  });

  it('tidak mengubah apa pun bila peran sama (urutan diabaikan)', () => {
    const [r] = rencanakanImpor([b('lama@x.id', ['bendahara'])], ada);
    expect(r?.aksi).toBe('TETAP');
  });

  it('mengosongkan peran user yang nonaktif di SiKU', () => {
    const [r] = rencanakanImpor([b('lama@x.id', ['bendahara'], false)], ada);
    expect(r).toMatchObject({ aksi: 'PERBARUI', sikuRoles: [] });
  });

  it('melewati user baru yang nonaktif atau tanpa peran', () => {
    const r = rencanakanImpor([b('a@x.id', [], true), b('c@x.id', ['ketua'], false)], ada);
    expect(r.map((x) => x.aksi)).toEqual(['LEWATI', 'LEWATI']);
  });
});
