import { describe, expect, it } from 'vitest';
import { EVENT_ROUTES, EVENTS, eventSchemas, parseEvent } from './events.js';

describe('events', () => {
  it('setiap event punya schema dan route', () => {
    for (const name of Object.values(EVENTS)) {
      expect(eventSchemas[name]).toBeDefined();
      expect(EVENT_ROUTES[name].length).toBeGreaterThan(0);
    }
  });

  it('menerima payload anggota.upserted yang valid', () => {
    const payload = parseEvent(EVENTS.ANGGOTA_UPSERTED, {
      id: 'a1',
      kode: 'JS-0001',
      nama: 'Ahmad',
      jk: 'L',
      tglLahir: '2010-05-01',
      kelompokId: 'k1',
      desaId: 'd1',
      daerahId: 'r1',
      status: 'AKTIF',
      noWa: null,
      waliNoWa: ['6281234567890'],
    });
    expect(payload.kode).toBe('JS-0001');
  });

  it('menolak nomor WA yang belum dinormalisasi', () => {
    expect(() =>
      parseEvent(EVENTS.ANGGOTA_UPSERTED, {
        id: 'a1',
        kode: 'JS-0001',
        nama: 'Ahmad',
        jk: 'L',
        tglLahir: null,
        kelompokId: 'k1',
        desaId: 'd1',
        daerahId: 'r1',
        status: 'AKTIF',
        noWa: '081234567890',
        waliNoWa: [],
      }),
    ).toThrow();
  });

  it('menolak alasan izin lebih dari 300 karakter', () => {
    expect(() =>
      parseEvent(EVENTS.IZIN_SUBMITTED, {
        izinId: 'i1',
        anggotaId: 'a1',
        acaraId: 'c1',
        kategori: 'SAKIT',
        alasan: 'x'.repeat(301),
      }),
    ).toThrow();
  });
});
