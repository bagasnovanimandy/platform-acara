import type { Prisma } from '../generated/prisma/client.js';
import type { Level, WilayahRef, WilayahTree } from '../scope/scope.js';

export type Tingkat = 'KELOMPOK' | 'DESA' | 'DAERAH' | 'GABUNGAN';

export interface Rule {
  level: string;
  refId: string;
  jenisKelamin: string | null;
  kategori: string[];
}

export interface AnggotaLike {
  status: string;
  jenisKelamin: string;
  kelompokId: string;
  desaId: string;
  daerahId: string;
  kategori: string[];
}

const wilayahField = { DAERAH: 'daerahId', DESA: 'desaId', KELOMPOK: 'kelompokId' } as const;

/** Filter Prisma AnggotaRef untuk peserta acara: AKTIF dan cocok salah satu aturan. */
export function pesertaWhere(rules: Rule[]): Prisma.AnggotaRefWhereInput {
  if (rules.length === 0) return { id: { in: [] } };
  return {
    status: 'AKTIF',
    OR: rules.map((r) => ({
      [wilayahField[r.level as Level]]: r.refId,
      ...(r.jenisKelamin ? { jenisKelamin: r.jenisKelamin } : {}),
      ...(r.kategori.length ? { kategori: { hasSome: r.kategori } } : {}),
    })),
  };
}

/** Versi di memori dari `pesertaWhere` (untuk riwayat acara satu anggota). */
export function isPeserta(a: AnggotaLike, rules: Rule[]): boolean {
  if (a.status !== 'AKTIF') return false;
  return rules.some(
    (r) =>
      a[wilayahField[r.level as Level]] === r.refId &&
      (!r.jenisKelamin || r.jenisKelamin === a.jenisKelamin) &&
      (r.kategori.length === 0 || r.kategori.some((k) => a.kategori.includes(k))),
  );
}

/** Tingkat & wilayah harus cocok: KELOMPOK/DESA/DAERAH = tepat satu wilayah di level itu. */
export function validateTingkat(tingkat: Tingkat, wilayah: WilayahRef[]): string | null {
  if (wilayah.length === 0) return 'Pilih minimal satu wilayah peserta';
  if (new Set(wilayah.map((w) => w.id)).size !== wilayah.length) return 'Wilayah dobel';
  if (tingkat === 'GABUNGAN') {
    return wilayah.length < 2 ? 'Acara gabungan butuh minimal dua wilayah' : null;
  }
  if (wilayah.length !== 1 || wilayah[0]!.level !== tingkat) {
    return `Acara tingkat ${tingkat.toLowerCase()} memakai tepat satu ${tingkat.toLowerCase()}`;
  }
  return null;
}

/** Induk sampai daerah: [kelompok?, desa?, daerah]. */
function lineage(w: WilayahRef, tree: WilayahTree): WilayahRef[] | null {
  const out: WilayahRef[] = [];
  let desaId: string | undefined;
  if (w.level === 'KELOMPOK') {
    const k = tree.kelompok.find((x) => x.id === w.id);
    if (!k) return null;
    out.push(w);
    desaId = k.desaId;
  }
  if (w.level === 'DESA') desaId = w.id;
  let daerahId: string | undefined = w.level === 'DAERAH' ? w.id : undefined;
  if (desaId) {
    const d = tree.desa.find((x) => x.id === desaId);
    if (!d) return null;
    out.push({ level: 'DESA', id: d.id });
    daerahId = d.daerahId;
  }
  if (!daerahId || !tree.daerah.some((x) => x.id === daerahId)) return null;
  out.push({ level: 'DAERAH', id: daerahId });
  return out;
}

/**
 * Penyelenggara = wilayah terkecil yang mencakup semua wilayah peserta.
 * `null` bila ada wilayah tidak dikenal atau lintas daerah.
 */
export function penyelenggara(wilayah: WilayahRef[], tree: WilayahTree): WilayahRef | null {
  const lines = wilayah.map((w) => lineage(w, tree));
  if (lines.some((l) => l === null) || lines.length === 0) return null;
  const [first, ...rest] = lines as WilayahRef[][];
  // Telusuri dari bawah: wilayah pertama (paling spesifik) yang ada di semua garis keturunan.
  for (const cand of first!) {
    if (rest.every((l) => l.some((x) => x.level === cand.level && x.id === cand.id))) return cand;
  }
  return null;
}
