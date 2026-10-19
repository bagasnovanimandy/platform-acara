import type { KategoriWarna } from '@platform-acara/shared/kategori';
import type { AuditLog } from './types';

/** Respons `GET /dashboard/ringkasan`. */
export interface Ringkasan {
  total: number;
  aktif: number;
  status: { AKTIF: number; PINDAH: number; NONAKTIF: number };
  jenisKelamin: { L: number; P: number };
  tanpaKategori: number;
  /** Rasio 0–1 terhadap anggota aktif. */
  kelengkapan: { kategori: number; kontak: number; tanggalLahir: number };
  kategori: { id: string; nama: string; warna: KategoriWarna; jumlah: number }[];
  wilayah: {
    id: string;
    nama: string;
    jumlah: number;
    kelompok: { id: string; nama: string; jumlah: number }[];
  }[];
  /** 12 bulan terakhir, `bulan` = `YYYY-MM` (WIB). */
  pertumbuhan: { bulan: string; baru: number; masuk: number; keluar: number; dalam: number }[];
}

export type GrupAksi = 'tambah' | 'ubah' | 'pindah' | 'wali';

/** Respons `GET /dashboard/audit`. */
export interface AktivitasAudit {
  total: number;
  perHari: ({ hari: string } & Record<GrupAksi, number>)[];
  pelaku: { id: string; nama: string; jumlah: number }[];
  entitas: { nama: string; jumlah: number }[];
  terbaru: AuditLog[];
}
