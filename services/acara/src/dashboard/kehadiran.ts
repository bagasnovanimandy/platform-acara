/** Statistik kehadiran untuk dashboard (dari rekap sesi yang sudah ditutup). Murni. */
import { ringkas, type Ringkasan, type StatusRekap } from '../rekap/rekap.js';
import { bulanWib, rentangBulan } from './statistik.js';

export interface BarisKehadiran {
  sesiId: string;
  sesiNama: string;
  acaraId: string;
  acaraNama: string;
  mulai: Date;
  status: StatusRekap;
  terlambat: boolean;
  /** Kode kategori anggota; kosong = belum di-assessment. */
  kategori: string[];
}

export interface StatistikKehadiran {
  ringkas: Ringkasan;
  /** 6 bulan terakhir (WIB), urut lama → baru. */
  perBulan: (Ringkasan & { bulan: string })[];
  /** Per kode kategori; anggota tanpa kategori di `BELUM`. Anggota berkategori banyak dihitung di tiap kategorinya. */
  perKategori: (Ringkasan & { kode: string })[];
  /** 5 sesi terakhir. */
  sesiTerbaru: {
    id: string;
    nama: string;
    mulai: Date;
    acara: { id: string; nama: string };
    ringkas: Ringkasan;
  }[];
}

export function statistikKehadiran(rows: readonly BarisKehadiran[], now: Date): StatistikKehadiran {
  const bulan = rentangBulan(now, 5, 0);
  const perBulan = new Map<string, BarisKehadiran[]>(bulan.map((b) => [b, []]));
  const perKategori = new Map<string, BarisKehadiran[]>();
  const perSesi = new Map<string, BarisKehadiran[]>();
  for (const r of rows) {
    perBulan.get(bulanWib(r.mulai))?.push(r);
    for (const k of r.kategori.length ? r.kategori : ['BELUM']) {
      perKategori.set(k, [...(perKategori.get(k) ?? []), r]);
    }
    perSesi.set(r.sesiId, [...(perSesi.get(r.sesiId) ?? []), r]);
  }
  return {
    ringkas: ringkas(rows),
    perBulan: bulan.map((b) => ({ bulan: b, ...ringkas(perBulan.get(b) ?? []) })),
    perKategori: [...perKategori.entries()]
      .map(([kode, rs]) => ({ kode, ...ringkas(rs) }))
      .sort((a, b) => b.peserta - a.peserta),
    sesiTerbaru: [...perSesi.values()]
      .sort((a, b) => b[0]!.mulai.getTime() - a[0]!.mulai.getTime())
      .slice(0, 5)
      .map((rs) => ({
        id: rs[0]!.sesiId,
        nama: rs[0]!.sesiNama,
        mulai: rs[0]!.mulai,
        acara: { id: rs[0]!.acaraId, nama: rs[0]!.acaraNama },
        ringkas: ringkas(rs),
      })),
  };
}
