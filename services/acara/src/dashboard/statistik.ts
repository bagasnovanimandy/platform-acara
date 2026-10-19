/** Agregasi statistik acara sebagai fungsi murni (mudah diuji). */

const WIB_MS = 7 * 3600_000;

/** Kunci bulan `YYYY-MM` menurut Asia/Jakarta. */
export function bulanWib(d: Date): string {
  return new Date(d.getTime() + WIB_MS).toISOString().slice(0, 7);
}

/** Bulan dari `mundur` bulan lalu sampai `maju` bulan ke depan, urut lama → baru. */
export function rentangBulan(now: Date, mundur: number, maju: number): string[] {
  const wib = new Date(now.getTime() + WIB_MS);
  const out: string[] = [];
  for (let i = -mundur; i <= maju; i++) {
    out.push(
      new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + i, 1)).toISOString().slice(0, 7),
    );
  }
  return out;
}

export const STATUS = ['DRAFT', 'TERJADWAL', 'BERLANGSUNG', 'SELESAI', 'BATAL'] as const;
export const TINGKAT = ['KELOMPOK', 'DESA', 'DAERAH', 'GABUNGAN'] as const;
export type Status = (typeof STATUS)[number];
export type Tingkat = (typeof TINGKAT)[number];

export interface AcaraRow {
  id: string;
  nama: string;
  status: Status;
  tingkat: Tingkat;
  lokasi: string | null;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  jumlahSesi: number;
}

export interface StatistikAcara {
  total: number;
  bulanIni: number;
  akanDatang: number;
  sesi: number;
  status: Record<Status, number>;
  tingkat: Record<Tingkat, number>;
  /** 6 bulan lalu s.d. 5 bulan ke depan; acara BATAL tidak dihitung. */
  perBulan: { bulan: string; jumlah: number; lewat: boolean }[];
  /** Acara terdekat yang belum selesai (maks 5). */
  terdekat: Pick<AcaraRow, 'id' | 'nama' | 'status' | 'tingkat' | 'lokasi' | 'tanggalMulai'>[];
}

const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function statistikAcara(rows: AcaraRow[], now: Date): StatistikAcara {
  const ini = bulanWib(now);
  const bulan = rentangBulan(now, 6, 5);
  const perBulan = new Map(bulan.map((b) => [b, 0]));
  const status = zero(STATUS);
  const tingkat = zero(TINGKAT);
  let bulanIni = 0;
  let sesi = 0;
  for (const a of rows) {
    status[a.status]++;
    tingkat[a.tingkat]++;
    sesi += a.jumlahSesi;
    if (a.status === 'BATAL') continue;
    const b = bulanWib(a.tanggalMulai);
    if (b === ini) bulanIni++;
    if (perBulan.has(b)) perBulan.set(b, perBulan.get(b)! + 1);
  }
  const mendatang = rows
    .filter((a) => a.status !== 'BATAL' && a.status !== 'SELESAI' && a.tanggalSelesai >= now)
    .sort((a, b) => a.tanggalMulai.getTime() - b.tanggalMulai.getTime());
  return {
    total: rows.length,
    bulanIni,
    akanDatang: mendatang.length,
    sesi,
    status,
    tingkat,
    perBulan: bulan.map((b) => ({ bulan: b, jumlah: perBulan.get(b)!, lewat: b < ini })),
    terdekat: mendatang
      .slice(0, 5)
      .map(({ id, nama, status: s, tingkat: t, lokasi, tanggalMulai }) => ({
        id,
        nama,
        status: s,
        tingkat: t,
        lokasi,
        tanggalMulai,
      })),
  };
}
