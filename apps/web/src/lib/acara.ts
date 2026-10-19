'use client';

import { useQuery } from '@tanstack/react-query';
import { acaraApi } from './api';

export type StatusAcara = 'DRAFT' | 'TERJADWAL' | 'BERLANGSUNG' | 'SELESAI' | 'BATAL';
export type Tingkat = 'KELOMPOK' | 'DESA' | 'DAERAH' | 'GABUNGAN';
export type LevelWilayah = 'DAERAH' | 'DESA' | 'KELOMPOK';
export type PeranPJ = 'PJ_UMUM' | 'PJ_IZIN' | 'PJ_ABSENSI' | 'PJ_DOKUMENTASI' | 'LAINNYA';

export interface WilayahPick {
  level: LevelWilayah;
  id: string;
}

export interface Acara {
  id: string;
  nama: string;
  jenis: string;
  deskripsi: string | null;
  lokasi: string | null;
  tingkat: Tingkat;
  status: StatusAcara;
  tanggalMulai: string;
  tanggalSelesai: string;
  penyelenggaraLevel: LevelWilayah;
  penyelenggaraId: string;
  penyelenggaraNama: string;
  wilayah: (WilayahPick & { nama: string })[];
  jenisKelamin: 'L' | 'P' | null;
  /** Kode kategori; kosong = semua. */
  kategori: string[];
  bisaKelola: boolean;
  _count?: { sesi: number };
}

export interface AnggotaRingkas {
  id: string;
  kode: string;
  nama: string;
  namaKelompok: string;
  namaDesa?: string;
}

export interface Pengisi {
  id: string;
  anggotaId: string | null;
  namaBebas: string | null;
  peran: string | null;
  anggota: AnggotaRingkas | null;
}

export interface RundownItem {
  id: string;
  urutan: number;
  judul: string;
  keterangan: string | null;
  mulai: string | null;
  selesai: string | null;
  pengisi: Pengisi[];
}

export interface Sesi {
  id: string;
  nama: string;
  mulai: string;
  selesai: string;
  toleransiMenit: number;
  batasIzin: string | null;
  status: 'TERJADWAL' | 'DIBUKA' | 'DITUTUP';
  rundown: RundownItem[];
}

export interface PJ {
  id: string;
  userId: string;
  nama: string;
  peran: PeranPJ;
  keterangan: string | null;
}

export interface AcaraDetail extends Acara {
  jumlahPeserta: number;
  sesi: Sesi[];
  pj: PJ[];
}

export interface Peserta {
  id: string;
  kode: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  namaKelompok: string;
  namaDesa: string;
  kategori: string[];
}

export interface PreviewPeserta {
  total: number;
  penyelenggara: { level: LevelWilayah; id: string } | null;
  perKelompok: { kelompokId: string; namaKelompok: string; namaDesa: string; jumlah: number }[];
  perJenisKelamin: Partial<Record<'L' | 'P', number>>;
  perKategori: Record<string, number>;
  contoh: { id: string; kode: string; nama: string; namaKelompok: string; kategori: string[] }[];
}

export interface Foto {
  id: string;
  sesiId: string | null;
  caption: string | null;
  createdAt: string;
}

export const STATUS_LABEL: Record<StatusAcara, string> = {
  DRAFT: 'Draf',
  TERJADWAL: 'Terjadwal',
  BERLANGSUNG: 'Berlangsung',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

export const STATUS_TONE: Record<StatusAcara, string> = {
  DRAFT: 'bg-muted text-muted-foreground ring-border',
  TERJADWAL: 'bg-sky-100 text-sky-900 ring-sky-300',
  BERLANGSUNG: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  SELESAI: 'bg-slate-100 text-slate-700 ring-slate-300',
  BATAL: 'bg-rose-100 text-rose-900 ring-rose-300',
};

export const TINGKAT_LABEL: Record<Tingkat, string> = {
  KELOMPOK: 'Kelompok',
  DESA: 'Desa',
  DAERAH: 'Daerah',
  GABUNGAN: 'Gabungan',
};

export const PERAN_PJ_LABEL: Record<PeranPJ, string> = {
  PJ_UMUM: 'PJ umum',
  PJ_IZIN: 'PJ izin',
  PJ_ABSENSI: 'PJ absensi',
  PJ_DOKUMENTASI: 'PJ dokumentasi',
  LAINNYA: 'Lainnya',
};

const WIB_MS = 7 * 3600_000;

/** ISO (UTC) → nilai `<input type="datetime-local">` dalam WIB. */
export function toWibInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + WIB_MS).toISOString().slice(0, 16);
}

/** Nilai `datetime-local` (dibaca sebagai WIB) → ISO dengan offset +07:00. */
export function fromWibInput(v: string): string {
  return `${v}:00+07:00`;
}

/** `19 Okt` / `19 Okt 2026, 08.00–11.00` (Asia/Jakarta). */
export function formatJam(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));
}

export function formatRentang(mulai: string, selesai: string): string {
  const tgl = (iso: string) =>
    new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  const a = tgl(mulai);
  const b = tgl(selesai);
  return a === b
    ? `${a}, ${formatJam(mulai)}–${formatJam(selesai)} WIB`
    : `${a} ${formatJam(mulai)} – ${b} ${formatJam(selesai)} WIB`;
}

/** Tanggal (YYYY-MM-DD) di WIB, untuk mengelompokkan di kalender. */
export function tanggalWib(iso: string): string {
  return new Date(new Date(iso).getTime() + WIB_MS).toISOString().slice(0, 10);
}

export function useAcara(id: string) {
  return useQuery({
    queryKey: ['acara', id],
    queryFn: () => acaraApi<AcaraDetail>(`/acara/${id}`),
  });
}
