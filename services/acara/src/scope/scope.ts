export type Level = 'DAERAH' | 'DESA' | 'KELOMPOK';

export interface WilayahRef {
  level: Level;
  id: string;
}

/** Pohon wilayah datar dari core (/internal/wilayah). */
export interface WilayahTree {
  daerah: { id: string; kode: string; nama: string }[];
  desa: { id: string; kode: string; nama: string; daerahId: string }[];
  kelompok: { id: string; kode: string; nama: string; desaId: string }[];
}

/** Scope user dari core (/internal/users/:id/scope). */
export interface Scope {
  all: boolean;
  manageDaerah: ReadonlySet<string>;
  manageDesa: ReadonlySet<string>;
  manageKelompok: ReadonlySet<string>;
  visibleDaerah: ReadonlySet<string>;
  visibleDesa: ReadonlySet<string>;
}

export function canManage(s: Scope, w: WilayahRef): boolean {
  if (s.all) return true;
  if (w.level === 'DAERAH') return s.manageDaerah.has(w.id);
  if (w.level === 'DESA') return s.manageDesa.has(w.id);
  return s.manageKelompok.has(w.id);
}

/** Wilayah bersinggungan dengan scope user (sama, di bawah, atau di atas wilayah user). */
export function overlaps(s: Scope, w: WilayahRef): boolean {
  if (s.all || canManage(s, w)) return true;
  if (w.level === 'DAERAH') return s.visibleDaerah.has(w.id);
  if (w.level === 'DESA') return s.visibleDesa.has(w.id);
  return false;
}
