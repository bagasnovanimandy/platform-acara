'use client';

import { useQuery } from '@tanstack/react-query';
import { wabotApi } from './api';
import { useAuth } from './auth';

export type StatusIzin = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type KategoriIzin = 'IZIN' | 'SAKIT';

export interface Izin {
  id: string;
  nomor: number;
  anggotaId: string;
  kodeAnggota: string;
  namaAnggota: string;
  namaKelompok: string;
  namaDesa: string;
  pengajuTipe: 'ANGGOTA' | 'WALI';
  acaraId: string;
  acaraNama: string;
  sesiNama: string;
  sesiMulai: string;
  kategori: KategoriIzin;
  alasan: string;
  status: StatusIzin;
  decidedByNama: string | null;
  decidedVia: 'WA' | 'WEB' | null;
  decidedAt: string | null;
  catatanPengurus: string | null;
  createdAt: string;
  bisaPutus: boolean;
}

export interface StatusWa {
  driver: 'baileys' | 'fake';
  keadaan: 'TERHUBUNG' | 'MENUNGGU_QR' | 'MENYAMBUNG' | 'TERPUTUS';
  qr: string | null;
  nomor: string | null;
  sejak: string;
  pesan: string | null;
}

export const nomorIzin = (n: number) => `IZ-${String(n).padStart(4, '0')}`;

export const STATUS_IZIN: Record<StatusIzin, string> = {
  SUBMITTED: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

/** Jumlah izin menunggu keputusan di wilayah user (badge menu), diperbarui tiap 30 dtk. */
export function useJumlahIzin(): number | null {
  const user = useAuth((s) => s.user);
  const q = useQuery({
    queryKey: ['izin', 'jumlah'],
    queryFn: () => wabotApi<{ menunggu: number }>('/izin/jumlah'),
    enabled: !!user,
    refetchInterval: 30_000,
    retry: false,
  });
  return q.data?.menunggu ?? null;
}
