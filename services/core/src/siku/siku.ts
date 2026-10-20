/** Logika murni impor pengguna SiKU ke core. */

export interface BarisImpor {
  email: string;
  nama: string;
  sikuRoles: string[];
  passwordHash?: string;
  aktif: boolean;
}

export interface UserAda {
  id: string;
  sikuRoles: string[];
}

export type Rencana =
  | { aksi: 'BUAT'; baris: BarisImpor }
  | { aksi: 'PERBARUI'; id: string; baris: BarisImpor; sikuRoles: string[]; sebelum: string[] }
  | { aksi: 'TETAP' | 'LEWATI'; baris: BarisImpor; alasan?: string };

const urut = (r: string[]) => [...new Set(r)].sort();
const sama = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * SiKU adalah sumber kebenaran untuk peran SiKU: peran user core yang sudah ada diganti
 * dengan yang diimpor (user nonaktif di SiKU → peran dikosongkan). Role, wilayah, dan
 * password user core yang sudah ada tidak disentuh. User baru hanya dibuat bila aktif
 * dan punya peran.
 */
export function rencanakanImpor(baris: BarisImpor[], ada: Map<string, UserAda>): Rencana[] {
  return baris.map((b) => {
    const target = b.aktif ? urut(b.sikuRoles) : [];
    const u = ada.get(b.email);
    if (u) {
      const sebelum = urut(u.sikuRoles);
      return sama(sebelum, target)
        ? { aksi: 'TETAP', baris: b }
        : { aksi: 'PERBARUI', id: u.id, baris: b, sikuRoles: target, sebelum };
    }
    if (target.length === 0)
      return { aksi: 'LEWATI', baris: b, alasan: b.aktif ? 'tanpa peran' : 'nonaktif' };
    return { aksi: 'BUAT', baris: { ...b, sikuRoles: target } };
  });
}
