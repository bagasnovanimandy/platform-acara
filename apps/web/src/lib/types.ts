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

import type { KategoriWarna } from '@platform-acara/shared/kategori';
import type { Role } from './api';

export type StatusAnggota = 'AKTIF' | 'PINDAH' | 'NONAKTIF';

export interface Anggota {
  id: string;
  kode: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tanggalLahir: string | null;
  kategori: KategoriRef[];
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
    kategori: KategoriRef[];
    noWa: string | null;
    noWaOrtu: string | null;
    namaOrtu: string | null;
    kelompok: string;
    desa: string;
    daerah: string;
  }[];
}

export interface KategoriRef {
  id: string;
  kode: string;
  nama: string;
  warna: KategoriWarna;
}

export interface Kategori extends KategoriRef {
  urutan: number;
  aktif: boolean;
  jumlahAnggota: number;
}

export interface MutasiSambung {
  id: string;
  dariKelompokId: string;
  keKelompokId: string;
  tanggal: string;
  catatan: string | null;
}

export interface AnggotaDetail extends Anggota {
  createdAt: string;
  updatedAt: string;
  wali: { hubungan: string; wali: { id: string; nama: string; noWa: string } }[];
  mutasi: MutasiSambung[];
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userNama: string;
  aksi: string;
  entitas: string;
  entitasId: string | null;
  ringkasan: string;
  data: Record<string, unknown> | null;
  daerahId: string | null;
  desaId: string | null;
  kelompokId: string | null;
  createdAt: string;
}

export type ScopeLevel = 'DAERAH' | 'DESA' | 'KELOMPOK';

export interface UserRow {
  id: string;
  nama: string;
  email: string;
  role: Role;
  noWa: string | null;
  aktif: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  scopes: { level: ScopeLevel; refId: string }[];
}
