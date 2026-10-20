'use client';

import { useAuth } from './auth';
import { useSse } from './sse';

export interface WajahRingkas {
  id: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  sumber: string;
  createdAt: string;
  jumlahThumbnail: number;
  pose: string[];
  anggota: { id: string; kode: string; nama: string; namaKelompok: string; namaDesa: string };
  pintu: string | null;
  sesi: { nama: string; acara: string } | null;
}

export interface WajahDetail extends WajahRingkas {
  alasanTolak: string | null;
  verifiedAt: string | null;
  absensi: number;
  sebelumnya: { id: string; verifiedAt: string | null; sumber: string; jumlahThumbnail: number }[];
}

export const thumbPath = (id: string, i: number) => `/face/${id}/thumb/${i}`;

/** Badge realtime "N wajah perlu verifikasi" (SSE). Hanya untuk admin & auditor. */
export function useJumlahWajahPending(): number | null {
  const role = useAuth((s) => s.user?.role);
  const boleh = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'AUDITOR';
  return useSse<{ jumlah: number }>(boleh ? '/face/pending/stream' : null).data?.jumlah ?? null;
}
