/**
 * Agregasi dashboard sebagai fungsi murni (mudah diuji). Service hanya mengambil data
 * yang sudah dibatasi scope lalu memanggil fungsi di sini.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kunci bulan `YYYY-MM` menurut Asia/Jakarta. */
export function bulanWib(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 7);
}

/** Kunci hari `YYYY-MM-DD` menurut Asia/Jakarta. */
export function hariWib(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** `n` bulan terakhir (termasuk bulan ini), urut lama → baru. */
export function daftarBulan(now: Date, n: number): string[] {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** `n` hari terakhir (termasuk hari ini), urut lama → baru. */
export function daftarHari(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(hariWib(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

const rasio = (n: number, total: number): number => (total === 0 ? 0 : n / total);

export interface AnggotaRow {
  status: 'AKTIF' | 'PINDAH' | 'NONAKTIF';
  jenisKelamin: 'L' | 'P';
  kelompokId: string;
  noWa: string | null;
  tanggalLahir: Date | null;
  createdAt: Date;
  jumlahKategori: number;
  jumlahWali: number;
}

export interface KelompokMeta {
  id: string;
  nama: string;
  desaId: string;
  namaDesa: string;
}

export interface KategoriMeta {
  id: string;
  nama: string;
  warna: string;
  urutan: number;
  aktif: boolean;
}

export interface MutasiRow {
  tanggal: Date;
  dariKelompokId: string;
  keKelompokId: string;
}

export interface RingkasanInput {
  anggota: AnggotaRow[];
  kelompok: KelompokMeta[];
  kategori: KategoriMeta[];
  /** jumlah anggota AKTIF per kategoriId (sudah dibatasi scope) */
  jumlahPerKategori: ReadonlyMap<string, number>;
  mutasi: MutasiRow[];
  /** kelompok yang termasuk wilayah user; `null` = semua */
  kelompokScope: ReadonlySet<string> | null;
  now: Date;
}

interface WilayahDesa {
  id: string;
  nama: string;
  jumlah: number;
  kelompok: { id: string; nama: string; jumlah: number }[];
}

export function ringkasan(input: RingkasanInput) {
  const { anggota, now } = input;
  const aktif = anggota.filter((a) => a.status === 'AKTIF');

  const status = { AKTIF: 0, PINDAH: 0, NONAKTIF: 0 };
  for (const a of anggota) status[a.status]++;
  const jenisKelamin = { L: 0, P: 0 };
  for (const a of aktif) jenisKelamin[a.jenisKelamin]++;

  const kategoriTerisi = aktif.filter((a) => a.jumlahKategori > 0).length;
  const kontakTerisi = aktif.filter((a) => a.noWa !== null || a.jumlahWali > 0).length;
  const tglTerisi = aktif.filter((a) => a.tanggalLahir !== null).length;

  // Per wilayah: semua kelompok dalam scope ikut (termasuk yang 0) agar celah terlihat.
  const perKelompok = new Map<string, number>();
  for (const a of aktif) perKelompok.set(a.kelompokId, (perKelompok.get(a.kelompokId) ?? 0) + 1);
  const desaMap = new Map<string, WilayahDesa>();
  for (const k of input.kelompok) {
    const desa = desaMap.get(k.desaId) ?? {
      id: k.desaId,
      nama: k.namaDesa,
      jumlah: 0,
      kelompok: [],
    };
    const jumlah = perKelompok.get(k.id) ?? 0;
    desa.jumlah += jumlah;
    desa.kelompok.push({ id: k.id, nama: k.nama, jumlah });
    desaMap.set(k.desaId, desa);
  }
  const urut = <T extends { jumlah: number; nama: string }>(a: T, b: T) =>
    b.jumlah - a.jumlah || a.nama.localeCompare(b.nama);
  const wilayah = [...desaMap.values()]
    .map((d) => ({ ...d, kelompok: d.kelompok.sort(urut) }))
    .sort(urut);

  const kategori = input.kategori
    .filter((k) => k.aktif || (input.jumlahPerKategori.get(k.id) ?? 0) > 0)
    .sort((a, b) => a.urutan - b.urutan)
    .map((k) => ({
      id: k.id,
      nama: k.nama,
      warna: k.warna,
      jumlah: input.jumlahPerKategori.get(k.id) ?? 0,
    }));

  const bulan = daftarBulan(now, 12);
  const baru = new Map(bulan.map((b) => [b, 0]));
  for (const a of anggota) {
    const b = bulanWib(a.createdAt);
    const n = baru.get(b);
    if (n !== undefined) baru.set(b, n + 1);
  }

  const inScope = (id: string) => input.kelompokScope === null || input.kelompokScope.has(id);
  const mutasi = new Map(bulan.map((b) => [b, { masuk: 0, keluar: 0, dalam: 0 }]));
  for (const m of input.mutasi) {
    const slot = mutasi.get(bulanWib(m.tanggal));
    if (!slot) continue;
    const [dari, ke] = [inScope(m.dariKelompokId), inScope(m.keKelompokId)];
    if (dari && ke) slot.dalam++;
    else if (ke) slot.masuk++;
    else if (dari) slot.keluar++;
  }

  return {
    total: anggota.length,
    aktif: aktif.length,
    status,
    jenisKelamin,
    tanpaKategori: aktif.length - kategoriTerisi,
    kelengkapan: {
      kategori: rasio(kategoriTerisi, aktif.length),
      kontak: rasio(kontakTerisi, aktif.length),
      tanggalLahir: rasio(tglTerisi, aktif.length),
    },
    kategori,
    wilayah,
    pertumbuhan: bulan.map((b) => ({
      bulan: b,
      baru: baru.get(b) ?? 0,
      ...(mutasi.get(b) ?? { masuk: 0, keluar: 0, dalam: 0 }),
    })),
  };
}

export type Ringkasan = ReturnType<typeof ringkasan>;

/** Kelompok aksi untuk grafik (maks. 4 seri agar warna tetap terbedakan). */
export const GRUP_AKSI = ['tambah', 'ubah', 'pindah', 'wali'] as const;
export type GrupAksi = (typeof GRUP_AKSI)[number];

export function grupAksi(aksi: string): GrupAksi {
  if (aksi === 'CREATE' || aksi === 'IMPORT') return 'tambah';
  if (aksi.startsWith('MUTASI')) return 'pindah';
  if (aksi === 'WALI') return 'wali';
  return 'ubah';
}

export interface AuditRow {
  aksi: string;
  entitas: string;
  userId: string | null;
  userNama: string;
  createdAt: Date;
}

export function aktivitas(rows: AuditRow[], now: Date, hari = 30) {
  const days = daftarHari(now, hari);
  const perHari = new Map(days.map((d) => [d, { tambah: 0, ubah: 0, pindah: 0, wali: 0 }]));
  const pelaku = new Map<string, { nama: string; jumlah: number }>();
  const entitas = new Map<string, number>();
  for (const r of rows) {
    const slot = perHari.get(hariWib(r.createdAt));
    if (!slot) continue;
    slot[grupAksi(r.aksi)]++;
    const key = r.userId ?? r.userNama;
    const p = pelaku.get(key) ?? { nama: r.userNama, jumlah: 0 };
    p.jumlah++;
    pelaku.set(key, p);
    entitas.set(r.entitas, (entitas.get(r.entitas) ?? 0) + 1);
  }
  const series = days.map((d) => ({
    hari: d,
    ...(perHari.get(d) ?? { tambah: 0, ubah: 0, pindah: 0, wali: 0 }),
  }));
  return {
    total: series.reduce((s, d) => s + d.tambah + d.ubah + d.pindah + d.wali, 0),
    perHari: series,
    pelaku: [...pelaku.entries()]
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 8),
    entitas: [...entitas.entries()]
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}
