export interface Kelompok {
  id: string;
  kode: string;
  nama: string;
  desaId: string;
  alamat: string | null;
}

export interface Desa {
  id: string;
  kode: string;
  nama: string;
  daerahId: string;
  bisaKelola: boolean;
  kelompok: Kelompok[];
}

export interface Daerah {
  id: string;
  kode: string;
  nama: string;
  bisaKelola: boolean;
  desa: Desa[];
}

export type StatusAnggota = 'AKTIF' | 'PINDAH' | 'NONAKTIF';

export interface Anggota {
  id: string;
  kode: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tanggalLahir: string | null;
  noWa: string | null;
  status: StatusAnggota;
  kelompokId: string;
  kelompok: {
    id: string;
    nama: string;
    desa: { id: string; nama: string; daerah: { id: string; nama: string } };
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  valid: number;
  gagal: number;
  dibuat: number;
  errors: { baris: number; nama: string; pesan: string[] }[];
  preview: {
    baris: number;
    nama: string;
    jenisKelamin: 'L' | 'P';
    tanggalLahir: string | null;
    noWa: string | null;
    noWaOrtu: string | null;
    namaOrtu: string | null;
    kelompok: string;
    desa: string;
    daerah: string;
  }[];
}
