/** Scope user dari core (/internal/users/:id/scope). */
export interface Scope {
  all: boolean;
  manageDaerah: ReadonlySet<string>;
  manageDesa: ReadonlySet<string>;
  manageKelompok: ReadonlySet<string>;
  visibleDaerah: ReadonlySet<string>;
  visibleDesa: ReadonlySet<string>;
}

/** Anggota di kelompok ini termasuk wilayah yang dikelola user. */
export const kelolaKelompok = (s: Scope, kelompokId: string): boolean =>
  s.all || s.manageKelompok.has(kelompokId);
