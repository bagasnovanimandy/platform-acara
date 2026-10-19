export type Level = 'DAERAH' | 'DESA' | 'KELOMPOK';

export interface WilayahTree {
  daerah: { id: string }[];
  desa: { id: string; daerahId: string }[];
  kelompok: { id: string; desaId: string }[];
}

export interface ScopeEntry {
  level: Level;
  refId: string;
}

/**
 * Wilayah yang boleh dikelola user.
 * - `manage*`: boleh ubah data di wilayah itu (dan anak-anaknya).
 * - `visible*`: boleh dilihat (termasuk induk, supaya pilihan bertingkat tetap utuh).
 */
export interface Scope {
  all: boolean;
  manageDaerah: ReadonlySet<string>;
  manageDesa: ReadonlySet<string>;
  manageKelompok: ReadonlySet<string>;
  visibleDaerah: ReadonlySet<string>;
  visibleDesa: ReadonlySet<string>;
}

export const FULL_SCOPE: Scope = {
  all: true,
  manageDaerah: new Set(),
  manageDesa: new Set(),
  manageKelompok: new Set(),
  visibleDaerah: new Set(),
  visibleDesa: new Set(),
};

export function computeScope(
  isSuperAdmin: boolean,
  entries: ScopeEntry[],
  tree: WilayahTree,
): Scope {
  if (isSuperAdmin) return FULL_SCOPE;

  const manageDaerah = new Set<string>();
  const manageDesa = new Set<string>();
  const manageKelompok = new Set<string>();

  for (const e of entries) {
    if (e.level === 'DAERAH') manageDaerah.add(e.refId);
    if (e.level === 'DESA') manageDesa.add(e.refId);
    if (e.level === 'KELOMPOK') manageKelompok.add(e.refId);
  }
  for (const d of tree.desa) if (manageDaerah.has(d.daerahId)) manageDesa.add(d.id);
  for (const k of tree.kelompok) if (manageDesa.has(k.desaId)) manageKelompok.add(k.id);

  const desaById = new Map(tree.desa.map((d) => [d.id, d]));
  const visibleDesa = new Set(manageDesa);
  for (const k of tree.kelompok) if (manageKelompok.has(k.id)) visibleDesa.add(k.desaId);
  const visibleDaerah = new Set(manageDaerah);
  for (const id of visibleDesa) {
    const desa = desaById.get(id);
    if (desa) visibleDaerah.add(desa.daerahId);
  }

  return { all: false, manageDaerah, manageDesa, manageKelompok, visibleDaerah, visibleDesa };
}

export const canManageDaerah = (s: Scope, id: string): boolean => s.all || s.manageDaerah.has(id);
export const canManageDesa = (s: Scope, id: string): boolean => s.all || s.manageDesa.has(id);
export const canManageKelompok = (s: Scope, id: string): boolean =>
  s.all || s.manageKelompok.has(id);
export const canSeeDaerah = (s: Scope, id: string): boolean => s.all || s.visibleDaerah.has(id);
export const canSeeDesa = (s: Scope, id: string): boolean => s.all || s.visibleDesa.has(id);

/** Filter Prisma `kelompokId` untuk query anggota; `undefined` = tanpa batas. */
export function kelompokFilter(s: Scope): { in: string[] } | undefined {
  return s.all ? undefined : { in: [...s.manageKelompok] };
}
