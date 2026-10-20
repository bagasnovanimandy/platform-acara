import { describe, expect, it } from 'vitest';
import { type Keadaan, type Kontak, type OpsiSesi, transisi } from './mesin.js';
import { bacaPerintah } from './perintah.js';
import { waktuSingkat } from './format.js';

const now = new Date('2026-10-20T01:00:00Z');
const anggota: Kontak = { tipe: 'ANGGOTA', anak: [{ id: 'a1', kode: 'JS-0001', nama: 'Ahmad' }] };
const wali: Kontak = {
  tipe: 'WALI',
  anak: [
    { id: 'a1', kode: 'JS-0001', nama: 'Ahmad' },
    { id: 'a2', kode: 'JS-0002', nama: 'Fatimah' },
  ],
};
const sesi = (id: string, mulai: string, batas = mulai, anggotaId = 'a1'): OpsiSesi => ({
  anggotaId,
  acaraId: 'ac1',
  acaraNama: 'Pengajian Umum',
  lokasi: 'Masjid Raya',
  sesiId: id,
  sesiNama: `Sesi ${id}`,
  mulai,
  batasIzin: batas,
});

/** Jalankan serangkaian pesan; efek MUAT_SESI dijawab dengan `items`. */
function jalan(kontak: Kontak, pesan: string[], items: OpsiSesi[] = []) {
  let k: Keadaan | null = null;
  const balas: string[][] = [];
  const efek = [];
  for (const teks of pesan) {
    let h = transisi(k, { type: 'PESAN', teks }, { kontak, now });
    const semua = [...h.balas];
    for (const e of h.efek) {
      efek.push(e);
      if (e.type === 'MUAT_SESI') {
        h = transisi(
          h.keadaan,
          { type: 'SESI', items: items.filter((s) => e.anggotaIds.includes(s.anggotaId)) },
          { kontak, now },
        );
        semua.push(...h.balas);
      }
    }
    k = h.keadaan;
    balas.push(semua);
  }
  return { k, balas, efek };
}

describe('mesin bot izin', () => {
  it('pesan pertama menyapa dan menampilkan menu', () => {
    const { k, balas } = jalan(anggota, ['halo']);
    expect(k).toEqual({ t: 'MENU' });
    expect(balas[0]![0]).toContain("Assalamu'alaikum, Ahmad.");
    expect(balas[0]![0]).toContain('1. Ajukan izin');
  });

  it('alur lengkap: pilih acara → kategori → alasan → kirim', () => {
    const items = [sesi('B', '2026-10-25T01:00:00Z'), sesi('A', '2026-10-22T01:00:00Z')];
    const { k, balas, efek } = jalan(
      anggota,
      ['hai', '1', '1', '2', 'demam sejak semalam', '1'],
      items,
    );
    // diurutkan menurut waktu mulai: A dulu
    expect(balas[1]!.join()).toMatch(/1\. Pengajian Umum — Kamis, 22 Okt 08\.00, Sesi A/);
    expect(balas[4]![0]).toContain('Kategori : Sakit');
    expect(balas[4]![0]).toContain('Alasan   : demam sejak semalam');
    expect(k).toEqual({ t: 'MENGIRIM' });
    expect(efek.at(-1)).toMatchObject({
      type: 'KIRIM_IZIN',
      anggotaId: 'a1',
      kategori: 'SAKIT',
      alasan: 'demam sejak semalam',
      sesi: { sesiId: 'A' },
    });
    const t = transisi(k, { type: 'TERKIRIM', nomor: 123 }, { kontak: anggota, now });
    expect(t.keadaan).toBeNull();
    expect(t.balas[0]).toContain('IZ-0123');
  });

  it('wali dengan dua anak memilih anak dulu', () => {
    const items = [sesi('A', '2026-10-22T01:00:00Z', undefined, 'a2')];
    const { balas, efek, k } = jalan(wali, ['x', '1', '2'], items);
    expect(balas[0]![0]).toContain('wali dari Ahmad dan Fatimah');
    expect(balas[1]![0]).toContain('2. Fatimah');
    expect(efek[0]).toEqual({ type: 'MUAT_SESI', anggotaIds: ['a2'] });
    expect(k).toMatchObject({ t: 'PILIH_ACARA', anggotaId: 'a2' });
  });

  it('sesi lewat batas izin tidak ditawarkan', () => {
    const items = [sesi('A', '2026-10-22T01:00:00Z', '2026-10-19T00:00:00Z')];
    const { k, balas } = jalan(anggota, ['x', '1'], items);
    expect(k).toEqual({ t: 'MENU' });
    expect(balas[1]!.join()).toContain('Tidak ada acara');
  });

  it('kirim ditolak bila batas izin lewat saat draft', () => {
    const s = sesi('A', '2026-10-22T01:00:00Z', '2026-10-20T00:30:00Z');
    const draft: Keadaan = { t: 'DRAFT', anggotaId: 'a1', sesi: s, kategori: 'IZIN', alasan: 'x' };
    const h = transisi(draft, { type: 'PESAN', teks: '1' }, { kontak: anggota, now });
    expect(h.efek).toEqual([]);
    expect(h.balas[0]).toContain('sudah lewat');
  });

  it('alasan > 300 karakter ditolak, ubah alasan kembali ke isi alasan', () => {
    const s = sesi('A', '2026-10-22T01:00:00Z');
    const isi: Keadaan = { t: 'ISI_ALASAN', anggotaId: 'a1', sesi: s, kategori: 'IZIN' };
    const panjang = transisi(
      isi,
      { type: 'PESAN', teks: 'a'.repeat(301) },
      { kontak: anggota, now },
    );
    expect(panjang.keadaan).toEqual(isi);
    expect(panjang.balas[0]).toContain('301 karakter');
    const draft = transisi(
      isi,
      { type: 'PESAN', teks: '  ada   acara keluarga ' },
      { kontak: anggota, now },
    );
    expect(draft.keadaan).toMatchObject({ t: 'DRAFT', alasan: 'ada acara keluarga' });
    const ubah = transisi(draft.keadaan, { type: 'PESAN', teks: '2' }, { kontak: anggota, now });
    expect(ubah.keadaan).toEqual(isi);
  });

  it('"menu" kapan saja kembali ke menu, "batal" mereset', () => {
    const k: Keadaan = {
      t: 'PILIH_KATEGORI',
      anggotaId: 'a1',
      sesi: sesi('A', '2026-10-22T01:00:00Z'),
    };
    expect(transisi(k, { type: 'PESAN', teks: 'MENU' }, { kontak: anggota, now }).keadaan).toEqual({
      t: 'MENU',
    });
    const b = transisi(k, { type: 'PESAN', teks: 'batal' }, { kontak: anggota, now });
    expect(b.keadaan).toBeNull();
  });

  it('pilihan tidak valid tetap di langkah yang sama', () => {
    const k: Keadaan = {
      t: 'PILIH_KATEGORI',
      anggotaId: 'a1',
      sesi: sesi('A', '2026-10-22T01:00:00Z'),
    };
    expect(transisi(k, { type: 'PESAN', teks: '3' }, { kontak: anggota, now }).keadaan).toEqual(k);
    expect(
      transisi({ t: 'MENU' }, { type: 'PESAN', teks: 'izin dong' }, { kontak: anggota, now })
        .balas[0],
    ).toContain('tidak dikenal');
  });

  it('status dan jadwal', () => {
    const st = transisi({ t: 'MENU' }, { type: 'PESAN', teks: '2' }, { kontak: wali, now });
    expect(st.efek).toEqual([{ type: 'MUAT_STATUS' }]);
    const s = transisi(
      st.keadaan,
      {
        type: 'STATUS',
        items: [
          {
            nomor: 7,
            namaAnggota: 'Fatimah',
            acaraNama: 'Pengajian',
            sesiNama: 'Pagi',
            sesiMulai: '2026-10-25T01:00:00Z',
            kategori: 'IZIN',
            status: 'REJECTED',
            catatan: 'wajib hadir',
          },
        ],
      },
      { kontak: wali, now },
    );
    expect(s.balas[0]).toContain('IZ-0007 · Fatimah · Pengajian, Pagi (Ahad, 25 Okt 08.00) · Izin');
    expect(s.balas[0]).toContain('*Ditolak*');
    expect(s.balas[0]).toContain('Catatan: wajib hadir');
    const j = jalan(wali, ['x', '3'], [sesi('A', '2026-10-22T01:00:00Z', undefined, 'a2')]);
    expect(j.efek[0]).toEqual({ type: 'MUAT_SESI', anggotaIds: ['a1', 'a2'] });
    expect(j.balas[1]!.join()).toContain('Masjid Raya (Fatimah)');
  });
});

describe('perintah pengurus', () => {
  it('membaca SETUJU / TOLAK', () => {
    expect(bacaPerintah('SETUJU 0123')).toEqual({ aksi: 'APPROVED', nomor: 123, catatan: null });
    expect(bacaPerintah('setuju IZ-0123')).toEqual({ aksi: 'APPROVED', nomor: 123, catatan: null });
    expect(bacaPerintah('Tolak 45 harus hadir, ujian')).toEqual({
      aksi: 'REJECTED',
      nomor: 45,
      catatan: 'harus hadir, ujian',
    });
    expect(bacaPerintah('setujuu 1')).toBeNull();
    expect(bacaPerintah('1')).toBeNull();
    expect(bacaPerintah('setuju 12a')).toBeNull();
  });

  it('format waktu WIB dengan hari Ahad', () => {
    expect(waktuSingkat('2026-10-24T23:30:00Z')).toBe('Ahad, 25 Okt 06.30');
  });
});
