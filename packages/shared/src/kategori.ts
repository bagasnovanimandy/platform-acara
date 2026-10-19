/**
 * Kategori peserta (Caberawit, Remaja, Dewasa, Ibu-ibu, …) adalah daftar yang dikelola admin
 * di core (tabel Kategori). Satu anggota boleh punya banyak kategori; diisi manual dari
 * assessment, tidak dihitung dari umur.
 */

/** Warna yang boleh dipilih untuk kategori (nama palet di UI). */
export const KATEGORI_WARNA = [
  'slate',
  'amber',
  'sky',
  'emerald',
  'violet',
  'indigo',
  'teal',
  'stone',
  'rose',
  'cyan',
  'lime',
  'orange',
  'fuchsia',
] as const;

export type KategoriWarna = (typeof KATEGORI_WARNA)[number];

/** Kode kategori dari nama: "Ibu-ibu" → "IBU_IBU". */
export function kodeKategori(nama: string): string {
  return nama
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Nama untuk dicocokkan (abaikan huruf besar, spasi, tanda hubung): "Pra Remaja" = "pra-remaja". */
export function kunciKategori(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}
