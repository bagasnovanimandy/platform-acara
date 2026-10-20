/** Format teks pesan WA (tanggal WIB, nomor izin). Murni. */

const ZONA = 'Asia/Jakarta';

/** `Ahad, 25 Okt 08.00` (hari Minggu ditulis Ahad). */
export function waktuSingkat(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const hari = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: ZONA })
    .format(d)
    .replace('Minggu', 'Ahad');
  const tgl = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: ZONA,
  }).format(d);
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA,
  }).format(d);
  return `${hari}, ${tgl} ${jam}`;
}

/** 123 → `IZ-0123`. */
export const nomorIzin = (n: number): string => `IZ-${String(n).padStart(4, '0')}`;

export const KATEGORI_LABEL = { IZIN: 'Izin', SAKIT: 'Sakit' } as const;

export const STATUS_LABEL = {
  SUBMITTED: 'Menunggu persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
} as const;

export type KategoriIzin = keyof typeof KATEGORI_LABEL;
export type StatusIzin = keyof typeof STATUS_LABEL;
