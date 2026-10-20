export type StatusRekap = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';
export const STATUS_REKAP: StatusRekap[] = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'];

/** Warna seri tetap (urut palet chart), label selalu ikut tampil. */
export const STATUS_INFO: Record<StatusRekap, { label: string; singkat: string; color: string }> = {
  HADIR: { label: 'Hadir', singkat: 'H', color: 'var(--chart-1)' },
  IZIN: { label: 'Izin', singkat: 'I', color: 'var(--chart-2)' },
  SAKIT: { label: 'Sakit', singkat: 'S', color: 'var(--chart-3)' },
  ALPHA: { label: 'Alpha', singkat: 'A', color: 'var(--chart-4)' },
};

export interface Ringkasan {
  peserta: number;
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
  terlambat: number;
  persenHadir: number;
}

export interface Wilayah {
  id: string;
  nama: string;
}

export interface AnggotaRekap {
  id: string;
  kode: string;
  nama: string;
  jenisKelamin: string;
  kategori: string[];
  kelompok: Wilayah;
  desa: Wilayah;
  daerah: Wilayah;
}

export interface BarisRekap {
  anggota: AnggotaRekap;
  status: StatusRekap;
  terlambat: boolean;
  waktu: string | null;
  metode: 'WAJAH' | 'MANUAL' | 'TAMU' | null;
  pintu: string | null;
  susulan: boolean;
  wajahPending: boolean;
  perluTinjau: boolean;
  izin: 'IZIN' | 'SAKIT' | null;
}

export interface RekapSesi {
  sesi: {
    id: string;
    nama: string;
    mulai: string;
    selesai: string;
    status: string;
    ditutupAt: string | null;
  };
  acara: { id: string; nama: string };
  final: boolean;
  dihitungAt: string | null;
  ringkas: Ringkasan;
  perKelompok: (Ringkasan & Wilayah)[];
  perDesa: (Ringkasan & Wilayah)[];
  items: BarisRekap[];
}

export interface RekapAcara {
  acara: { id: string; nama: string };
  sesi: { id: string; nama: string; mulai: string; final: boolean; ringkas: Ringkasan }[];
  ringkas: Ringkasan;
  perKelompok: (Ringkasan & Wilayah)[];
  anggota: { anggota: AnggotaRekap; status: (StatusRekap | null)[]; ringkas: Ringkasan }[];
}

export interface FilterWilayah {
  kelompokId?: string;
  desaId?: string;
}

export function qsFilter(f: FilterWilayah): string {
  const p = new URLSearchParams();
  if (f.kelompokId) p.set('kelompokId', f.kelompokId);
  if (f.desaId) p.set('desaId', f.desaId);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const persen = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
