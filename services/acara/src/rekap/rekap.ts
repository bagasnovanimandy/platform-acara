/** Logika rekap kehadiran (HANDOVER §5.9). Murni, tanpa database. */

export type StatusRekap = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';
export const STATUS_REKAP: readonly StatusRekap[] = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'];

export interface AbsensiRekap {
  id: string;
  anggotaId: string;
  terlambat: boolean;
}

export interface IzinRekap {
  id: string;
  anggotaId: string;
  /** null = berlaku untuk semua sesi acara. */
  sesiId: string | null;
  kategori: 'IZIN' | 'SAKIT';
  status: string;
  updatedAt: Date;
}

export interface HasilRekap {
  anggotaId: string;
  status: StatusRekap;
  terlambat: boolean;
  absensiId: string | null;
  izinId: string | null;
}

/**
 * Status final tiap peserta: hadir mengalahkan izin; izin APPROVED khusus sesi ini
 * mengalahkan izin untuk seluruh acara; selain itu ALPHA.
 */
export function hitungRekap(
  sesiId: string,
  peserta: readonly string[],
  absensi: readonly AbsensiRekap[],
  izin: readonly IzinRekap[],
): HasilRekap[] {
  const hadir = new Map(absensi.map((a) => [a.anggotaId, a]));
  const izinBy = new Map<string, IzinRekap>();
  for (const i of izin) {
    if (i.status !== 'APPROVED' || (i.sesiId !== null && i.sesiId !== sesiId)) continue;
    const ada = izinBy.get(i.anggotaId);
    const lebihKhusus = ada && ada.sesiId === null && i.sesiId !== null;
    const lebihBaru =
      ada && (ada.sesiId === null) === (i.sesiId === null) && i.updatedAt > ada.updatedAt;
    if (!ada || lebihKhusus || lebihBaru) izinBy.set(i.anggotaId, i);
  }
  return [...new Set(peserta)].map((anggotaId) => {
    const a = hadir.get(anggotaId);
    if (a) {
      return { anggotaId, status: 'HADIR', terlambat: a.terlambat, absensiId: a.id, izinId: null };
    }
    const i = izinBy.get(anggotaId);
    if (i) {
      return { anggotaId, status: i.kategori, terlambat: false, absensiId: null, izinId: i.id };
    }
    return { anggotaId, status: 'ALPHA', terlambat: false, absensiId: null, izinId: null };
  });
}

export interface Ringkasan {
  peserta: number;
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
  terlambat: number;
  /** Persen hadir dari peserta (0–100, 1 desimal). */
  persenHadir: number;
}

export function ringkas(rows: readonly { status: StatusRekap; terlambat: boolean }[]): Ringkasan {
  const r: Ringkasan = {
    peserta: rows.length,
    HADIR: 0,
    IZIN: 0,
    SAKIT: 0,
    ALPHA: 0,
    terlambat: 0,
    persenHadir: 0,
  };
  for (const x of rows) {
    r[x.status]++;
    if (x.terlambat) r.terlambat++;
  }
  r.persenHadir = rows.length ? Math.round((r.HADIR / rows.length) * 1000) / 10 : 0;
  return r;
}

/** Kelompokkan baris per kunci (mis. kelompok/desa) lalu ringkas tiap kelompok, urut nama. */
export function ringkasPer<T extends { status: StatusRekap; terlambat: boolean }>(
  rows: readonly T[],
  kunci: (r: T) => { id: string; nama: string },
): (Ringkasan & { id: string; nama: string })[] {
  const grup = new Map<string, { nama: string; rows: T[] }>();
  for (const r of rows) {
    const k = kunci(r);
    const g = grup.get(k.id) ?? { nama: k.nama, rows: [] };
    g.rows.push(r);
    grup.set(k.id, g);
  }
  return [...grup.entries()]
    .map(([id, g]) => ({ id, nama: g.nama, ...ringkas(g.rows) }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

/** Sesi ditutup otomatis bila sudah lewat `selesai + 2 jam`. */
export const TUTUP_OTOMATIS_MS = 2 * 60 * 60_000;

export function perluDitutup(sesi: { selesai: Date; ditutupAt: Date | null }, now: Date): boolean {
  return !sesi.ditutupAt && sesi.selesai.getTime() + TUTUP_OTOMATIS_MS <= now.getTime();
}
