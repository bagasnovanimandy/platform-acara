import { kunciKategori, normalizeWa } from '@platform-acara/shared';

/** Kolom file import (header baris pertama, tidak peka huruf besar/kecil). */
export const IMPORT_COLUMNS = [
  'Nama',
  'JK',
  'Tgl Lahir',
  'Kategori',
  'No WA',
  'No WA Ortu',
  'Nama Ortu',
  'Kelompok',
  'Desa',
  'Daerah',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type CellValue = string | number | Date | null | undefined;
export type RawRow = Partial<Record<ImportColumn, CellValue>>;

export interface WilayahRef {
  kelompokId: string;
  kelompok: string;
  desaId: string;
  desa: string;
  kodeDesa: string;
  daerahId: string;
  daerah: string;
}

export interface KategoriRef {
  id: string;
  kode: string;
  nama: string;
  warna: string;
}

export interface ValidRow {
  baris: number;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tanggalLahir: string | null;
  kategoriIds: string[];
  noWa: string | null;
  noWaOrtu: string | null;
  namaOrtu: string | null;
  wilayah: WilayahRef;
}

export interface RowError {
  baris: number;
  nama: string;
  pesan: string[];
}

export interface ImportContext {
  /** key = `daerah|desa|kelompok` hasil normalizeName */
  wilayah: ReadonlyMap<string, WilayahRef>;
  canManageKelompok: (kelompokId: string) => boolean;
  /** Nomor WA anggota yang sudah terdaftar */
  existingNoWa: ReadonlySet<string>;
  /** Kategori aktif, key = id */
  kategori: ReadonlyMap<string, KategoriRef>;
}

export const normalizeName = (v: string): string => v.trim().replace(/\s+/g, ' ').toLowerCase();
export const wilayahKey = (daerah: string, desa: string, kelompok: string): string =>
  [daerah, desa, kelompok].map(normalizeName).join('|');

function text(v: CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

const JK: Record<string, 'L' | 'P'> = {
  l: 'L',
  lk: 'L',
  laki: 'L',
  'laki-laki': 'L',
  'laki laki': 'L',
  p: 'P',
  pr: 'P',
  perempuan: 'P',
  wanita: 'P',
};

/** Tanggal dari Date, nomor seri Excel, `dd/mm/yyyy`, `dd-mm-yyyy`, atau `yyyy-mm-dd`. */
export function parseTanggal(v: CellValue): string | null | 'invalid' {
  if (v == null || v === '') return null;
  let y: number, m: number, d: number;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return 'invalid';
    // Excel menyimpan tanggal tanpa zona; exceljs mengembalikannya sebagai UTC.
    [y, m, d] = [v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()];
  } else if (typeof v === 'number') {
    const date = new Date(Math.round((v - 25569) * 86400 * 1000));
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else {
    const s = v.trim();
    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    else {
      match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
      if (!match) return 'invalid';
      [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return 'invalid';
  }
  if (y < 1900 || date.getTime() > Date.now()) return 'invalid';
  return date.toISOString().slice(0, 10);
}

/** Validasi baris import. Fungsi murni: tidak menyentuh database. */
export function validateImportRows(
  rows: RawRow[],
  ctx: ImportContext,
  firstRow = 2,
): { valid: ValidRow[]; errors: RowError[] } {
  const valid: ValidRow[] = [];
  const errors: RowError[] = [];
  const seenNoWa = new Map<string, number>();
  const kategoriByKey = new Map<string, KategoriRef>();
  for (const k of ctx.kategori.values()) {
    kategoriByKey.set(kunciKategori(k.nama), k);
    kategoriByKey.set(kunciKategori(k.kode), k);
  }

  rows.forEach((row, i) => {
    const baris = firstRow + i;
    const pesan: string[] = [];
    const nama = text(row.Nama).replace(/\s+/g, ' ');
    if (!nama) pesan.push('Nama wajib diisi');
    else if (nama.length > 100) pesan.push('Nama maksimal 100 karakter');

    const jk = JK[normalizeName(text(row.JK))];
    if (!jk) pesan.push('JK harus L atau P');

    const tgl = parseTanggal(row['Tgl Lahir']);
    if (tgl === 'invalid') pesan.push('Tgl Lahir tidak valid (pakai dd/mm/yyyy)');

    // Kategori opsional (boleh lebih dari satu, pisahkan dengan koma); bisa diisi setelah assessment.
    const kategoriIds: string[] = [];
    for (const part of text(row.Kategori).split(/[,;/]/)) {
      if (!part.trim()) continue;
      const k = kategoriByKey.get(kunciKategori(part));
      if (!k) pesan.push(`Kategori "${part.trim()}" tidak dikenal`);
      else if (!kategoriIds.includes(k.id)) kategoriIds.push(k.id);
    }

    let noWa: string | null = null;
    if (text(row['No WA'])) {
      noWa = normalizeWa(text(row['No WA']));
      if (!noWa) pesan.push('No WA tidak valid');
      else if (ctx.existingNoWa.has(noWa)) pesan.push(`No WA ${noWa} sudah dipakai anggota lain`);
      else if (seenNoWa.has(noWa))
        pesan.push(`No WA ${noWa} sama dengan baris ${seenNoWa.get(noWa)}`);
      else seenNoWa.set(noWa, baris);
    }

    let noWaOrtu: string | null = null;
    if (text(row['No WA Ortu'])) {
      noWaOrtu = normalizeWa(text(row['No WA Ortu']));
      if (!noWaOrtu) pesan.push('No WA Ortu tidak valid');
      else if (noWaOrtu === noWa) pesan.push('No WA Ortu sama dengan No WA anggota');
    }
    const namaOrtu = text(row['Nama Ortu']).replace(/\s+/g, ' ') || null;

    const [kel, desa, daerah] = [text(row.Kelompok), text(row.Desa), text(row.Daerah)];
    let wilayah: WilayahRef | undefined;
    if (!kel || !desa || !daerah) pesan.push('Kelompok, Desa, dan Daerah wajib diisi');
    else {
      wilayah = ctx.wilayah.get(wilayahKey(daerah, desa, kel));
      if (!wilayah) pesan.push(`Wilayah "${kel} / ${desa} / ${daerah}" tidak ditemukan`);
      else if (!ctx.canManageKelompok(wilayah.kelompokId))
        pesan.push('Kelompok di luar wilayah Anda');
    }

    if (pesan.length > 0 || !jk || tgl === 'invalid' || !wilayah) {
      errors.push({ baris, nama: nama || '(kosong)', pesan });
      return;
    }
    valid.push({
      baris,
      nama,
      jenisKelamin: jk,
      tanggalLahir: tgl,
      kategoriIds,
      noWa,
      noWaOrtu,
      namaOrtu,
      wilayah,
    });
  });

  return { valid, errors };
}

/** Baris yang semua selnya kosong dilewati. */
export function isEmptyRow(row: RawRow): boolean {
  return IMPORT_COLUMNS.every((c) => text(row[c]) === '');
}
