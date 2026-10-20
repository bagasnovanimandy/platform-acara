/**
 * State machine bot WA (HANDOVER §5.8). Murni: tidak memanggil service lain.
 * Data yang perlu dimuat diminta lewat `efek`; hasilnya masuk lagi sebagai peristiwa.
 */
import {
  KATEGORI_LABEL,
  type KategoriIzin,
  nomorIzin,
  STATUS_LABEL,
  type StatusIzin,
  waktuSingkat,
} from './format.js';

export const MAKS_ALASAN = 300;

export interface Anak {
  id: string;
  kode: string;
  nama: string;
}

/** Pemilik nomor: anggota sendiri (satu "anak" = dirinya) atau wali dengan anak-anaknya. */
export interface Kontak {
  tipe: 'ANGGOTA' | 'WALI';
  anak: Anak[];
}

export interface OpsiSesi {
  anggotaId: string;
  acaraId: string;
  acaraNama: string;
  lokasi: string | null;
  sesiId: string;
  sesiNama: string;
  mulai: string;
  batasIzin: string;
}

export interface IzinRingkas {
  nomor: number;
  namaAnggota: string;
  acaraNama: string;
  sesiNama: string;
  sesiMulai: string;
  kategori: KategoriIzin;
  status: StatusIzin;
  catatan: string | null;
}

export type Keadaan =
  | { t: 'MENU' }
  | { t: 'PILIH_ANAK' }
  | { t: 'MEMUAT_SESI'; untuk: 'IZIN' | 'JADWAL'; anggotaId: string | null }
  | { t: 'PILIH_ACARA'; anggotaId: string; opsi: OpsiSesi[] }
  | { t: 'PILIH_KATEGORI'; anggotaId: string; sesi: OpsiSesi }
  | { t: 'ISI_ALASAN'; anggotaId: string; sesi: OpsiSesi; kategori: KategoriIzin }
  | { t: 'DRAFT'; anggotaId: string; sesi: OpsiSesi; kategori: KategoriIzin; alasan: string }
  | { t: 'MENGIRIM' };

export type Peristiwa =
  | { type: 'PESAN'; teks: string }
  | { type: 'SESI'; items: OpsiSesi[] }
  | { type: 'STATUS'; items: IzinRingkas[] }
  | { type: 'TERKIRIM'; nomor: number }
  | { type: 'GAGAL'; pesan: string };

export type Efek =
  | { type: 'MUAT_SESI'; anggotaIds: string[] }
  | { type: 'MUAT_STATUS' }
  | {
      type: 'KIRIM_IZIN';
      anggotaId: string;
      sesi: OpsiSesi;
      kategori: KategoriIzin;
      alasan: string;
    };

export interface Hasil {
  /** `null` = percakapan selesai (state dihapus). */
  keadaan: Keadaan | null;
  balas: string[];
  efek: Efek[];
}

export interface Konteks {
  kontak: Kontak;
  now: Date;
}

const hasil = (keadaan: Keadaan | null, balas: string[] = [], efek: Efek[] = []): Hasil => ({
  keadaan,
  balas,
  efek,
});

const daftarNama = (anak: Anak[]): string =>
  anak.length <= 2
    ? anak.map((a) => a.nama).join(' dan ')
    : `${anak
        .slice(0, -1)
        .map((a) => a.nama)
        .join(', ')}, dan ${anak.at(-1)!.nama}`;

export function teksMenu(kontak: Kontak, sapa: boolean): string {
  const salam = sapa
    ? `Assalamu'alaikum, ${kontak.tipe === 'WALI' ? `wali dari ${daftarNama(kontak.anak)}` : kontak.anak[0]!.nama}.\n\n`
    : '';
  return `${salam}Pilih menu (balas dengan angka):\n1. Ajukan izin\n2. Cek status izin\n3. Jadwal acara terdekat\n\nKetik *menu* untuk kembali ke sini, *batal* untuk membatalkan.`;
}

const labelSesi = (s: OpsiSesi): string =>
  `${s.acaraNama} — ${waktuSingkat(s.mulai)}, ${s.sesiNama}`;

export function teksDraft(
  anak: Anak,
  sesi: OpsiSesi,
  kategori: KategoriIzin,
  alasan: string,
): string {
  return [
    '*Ringkasan pengajuan*',
    `Nama     : ${anak.nama} (${anak.kode})`,
    `Acara    : ${labelSesi(sesi)}`,
    `Kategori : ${KATEGORI_LABEL[kategori]}`,
    `Alasan   : ${alasan}`,
    '',
    '1. Kirim',
    '2. Ubah alasan',
    '3. Batal',
  ].join('\n');
}

/** Angka 1..n dari teks, atau null. */
function pilihan(teks: string, n: number): number | null {
  const m = /^\s*(\d{1,3})\s*\.?\s*$/.exec(teks);
  if (!m) return null;
  const i = Number(m[1]);
  return i >= 1 && i <= n ? i : null;
}

function anakDari(ctx: Konteks, id: string): Anak {
  return ctx.kontak.anak.find((a) => a.id === id) ?? ctx.kontak.anak[0]!;
}

const masihBuka = (s: OpsiSesi, now: Date): boolean => new Date(s.batasIzin) > now;

function mulaiIzin(anggotaId: string): Hasil {
  return hasil(
    { t: 'MEMUAT_SESI', untuk: 'IZIN', anggotaId },
    [],
    [{ type: 'MUAT_SESI', anggotaIds: [anggotaId] }],
  );
}

function menu(ctx: Konteks, pesan: string[] = [], sapa = false): Hasil {
  return hasil({ t: 'MENU' }, [...pesan, teksMenu(ctx.kontak, sapa)]);
}

function pesanDiMenu(teks: string, ctx: Konteks): Hasil {
  const p = pilihan(teks, 3);
  const anak = ctx.kontak.anak;
  if (p === 1) {
    if (ctx.kontak.tipe === 'WALI' && anak.length > 1) {
      return hasil({ t: 'PILIH_ANAK' }, [
        `Izin untuk siapa?\n${anak.map((a, i) => `${i + 1}. ${a.nama}`).join('\n')}`,
      ]);
    }
    return mulaiIzin(anak[0]!.id);
  }
  if (p === 2) return hasil({ t: 'MENU' }, [], [{ type: 'MUAT_STATUS' }]);
  if (p === 3) {
    return hasil(
      { t: 'MEMUAT_SESI', untuk: 'JADWAL', anggotaId: null },
      [],
      [{ type: 'MUAT_SESI', anggotaIds: anak.map((a) => a.id) }],
    );
  }
  return menu(ctx, ['Maaf, pilihan tidak dikenal.']);
}

function pesan(k: Keadaan | null, teks: string, ctx: Konteks): Hasil {
  const kata = teks.trim().toLowerCase();
  if (kata === 'batal') {
    return hasil(null, ['Dibatalkan. Ketik *menu* untuk mulai lagi.']);
  }
  if (kata === 'menu' || k === null) return menu(ctx, [], k === null);

  switch (k.t) {
    case 'MENU':
      return pesanDiMenu(teks, ctx);
    case 'PILIH_ANAK': {
      const p = pilihan(teks, ctx.kontak.anak.length);
      if (!p) return hasil(k, ['Balas dengan angka nama anak.']);
      return mulaiIzin(ctx.kontak.anak[p - 1]!.id);
    }
    case 'PILIH_ACARA': {
      const p = pilihan(teks, k.opsi.length);
      if (!p) return hasil(k, [`Balas dengan angka 1–${k.opsi.length}.`]);
      const sesi = k.opsi[p - 1]!;
      return hasil({ t: 'PILIH_KATEGORI', anggotaId: k.anggotaId, sesi }, [
        `${labelSesi(sesi)}\n\nKategori:\n1. Izin\n2. Sakit`,
      ]);
    }
    case 'PILIH_KATEGORI': {
      const p = pilihan(teks, 2);
      if (!p) return hasil(k, ['Balas 1 untuk Izin atau 2 untuk Sakit.']);
      const kategori: KategoriIzin = p === 1 ? 'IZIN' : 'SAKIT';
      return hasil({ t: 'ISI_ALASAN', anggotaId: k.anggotaId, sesi: k.sesi, kategori }, [
        `Tulis alasan singkat (maks ${MAKS_ALASAN} karakter).`,
      ]);
    }
    case 'ISI_ALASAN': {
      const alasan = teks.trim().replace(/\s+/g, ' ');
      if (!alasan) return hasil(k, ['Alasan tidak boleh kosong.']);
      if (alasan.length > MAKS_ALASAN) {
        return hasil(k, [
          `Alasan terlalu panjang (${alasan.length} karakter, maks ${MAKS_ALASAN}). Tulis lebih singkat.`,
        ]);
      }
      return hasil({ ...k, t: 'DRAFT', alasan }, [
        teksDraft(anakDari(ctx, k.anggotaId), k.sesi, k.kategori, alasan),
      ]);
    }
    case 'DRAFT': {
      const p = pilihan(teks, 3);
      if (p === 1) {
        if (!masihBuka(k.sesi, ctx.now)) {
          return menu(ctx, ['Maaf, batas pengajuan izin untuk sesi ini sudah lewat.']);
        }
        return hasil(
          { t: 'MENGIRIM' },
          [],
          [
            {
              type: 'KIRIM_IZIN',
              anggotaId: k.anggotaId,
              sesi: k.sesi,
              kategori: k.kategori,
              alasan: k.alasan,
            },
          ],
        );
      }
      if (p === 2) {
        return hasil(
          { t: 'ISI_ALASAN', anggotaId: k.anggotaId, sesi: k.sesi, kategori: k.kategori },
          ['Tulis alasan yang baru.'],
        );
      }
      if (p === 3) return hasil(null, ['Pengajuan dibatalkan. Ketik *menu* untuk mulai lagi.']);
      return hasil(k, ['Balas 1 untuk Kirim, 2 untuk Ubah alasan, atau 3 untuk Batal.']);
    }
    case 'MEMUAT_SESI':
    case 'MENGIRIM':
      return hasil(k, ['Sebentar, sedang diproses…']);
  }
}

function sesiDimuat(k: Keadaan | null, items: OpsiSesi[], ctx: Konteks): Hasil {
  if (k?.t !== 'MEMUAT_SESI') return hasil(k);
  const urut = [...items].sort((a, b) => a.mulai.localeCompare(b.mulai));
  if (k.untuk === 'JADWAL') {
    if (urut.length === 0) return menu(ctx, ['Belum ada acara dalam 14 hari ke depan.']);
    const banyak = ctx.kontak.anak.length > 1;
    const baris = urut.map(
      (s) =>
        `• ${labelSesi(s)}${s.lokasi ? `, ${s.lokasi}` : ''}${banyak ? ` (${anakDari(ctx, s.anggotaId).nama})` : ''}`,
    );
    return hasil({ t: 'MENU' }, [
      `*Jadwal 14 hari ke depan*\n${baris.join('\n')}\n\nKetik *menu* untuk kembali.`,
    ]);
  }
  const anggotaId = k.anggotaId ?? ctx.kontak.anak[0]!.id;
  const opsi = urut.filter((s) => masihBuka(s, ctx.now));
  if (opsi.length === 0) {
    return menu(ctx, [
      `Tidak ada acara dalam 14 hari ke depan yang masih bisa diajukan izin untuk ${anakDari(ctx, anggotaId).nama}.`,
    ]);
  }
  return hasil({ t: 'PILIH_ACARA', anggotaId, opsi }, [
    `Pilih acara (balas dengan angka):\n${opsi.map((s, i) => `${i + 1}. ${labelSesi(s)}`).join('\n')}`,
  ]);
}

function statusDimuat(items: IzinRingkas[], ctx: Konteks): Hasil {
  if (items.length === 0) return menu(ctx, ['Belum ada pengajuan izin.']);
  const baris = items.map((i) => {
    const nama = ctx.kontak.anak.length > 1 ? `${i.namaAnggota} · ` : '';
    const catatan = i.catatan ? `\n   Catatan: ${i.catatan}` : '';
    return `• ${nomorIzin(i.nomor)} · ${nama}${i.acaraNama}, ${i.sesiNama} (${waktuSingkat(i.sesiMulai)}) · ${KATEGORI_LABEL[i.kategori]}\n   *${STATUS_LABEL[i.status]}*${catatan}`;
  });
  return hasil({ t: 'MENU' }, [
    `*Pengajuan izin terakhir*\n${baris.join('\n')}\n\nKetik *menu* untuk kembali.`,
  ]);
}

export function transisi(k: Keadaan | null, ev: Peristiwa, ctx: Konteks): Hasil {
  switch (ev.type) {
    case 'PESAN':
      return pesan(k, ev.teks, ctx);
    case 'SESI':
      return sesiDimuat(k, ev.items, ctx);
    case 'STATUS':
      return statusDimuat(ev.items, ctx);
    case 'TERKIRIM':
      return hasil(null, [
        `Izin terkirim (${nomorIzin(ev.nomor)}), menunggu persetujuan. Hasilnya akan dikabarkan lewat pesan ini.`,
      ]);
    case 'GAGAL':
      return menu(ctx, [ev.pesan]);
  }
}
