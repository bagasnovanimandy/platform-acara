/**
 * Kategori generus. Diisi manual per anggota oleh admin berdasarkan assessment tersendiri,
 * bukan dihitung dari tanggal lahir.
 */
export const KATEGORI_GENERUS = ['CABERAWIT', 'PRAREMAJA', 'REMAJA', 'USIA_NIKAH'] as const;

export type KategoriGenerus = (typeof KATEGORI_GENERUS)[number];

export const KATEGORI_GENERUS_LABEL: Record<KategoriGenerus, string> = {
  CABERAWIT: 'Caberawit',
  PRAREMAJA: 'Pra-remaja',
  REMAJA: 'Remaja',
  USIA_NIKAH: 'Usia nikah',
};

/** Teks bebas (mis. "Pra Remaja", "usia-nikah") → kategori; `null` bila tidak dikenali. */
export function parseKategori(v: string): KategoriGenerus | null {
  const key = v
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
  const alias: Record<string, KategoriGenerus> = {
    CABERAWIT: 'CABERAWIT',
    CABERAWITH: 'CABERAWIT',
    PRAREMAJA: 'PRAREMAJA',
    REMAJA: 'REMAJA',
    USIANIKAH: 'USIA_NIKAH',
    UN: 'USIA_NIKAH',
  };
  return alias[key] ?? null;
}
