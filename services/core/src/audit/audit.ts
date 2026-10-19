import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope/scope.js';

type Plain = string | number | boolean | null;

function plain(v: unknown): Plain {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return JSON.stringify(v);
}

/** Field yang berubah: `{ field: [sebelum, sesudah] }`. Field yang tidak ada di `after` dilewati. */
export function diffFields(before: object, after: object): Record<string, [Plain, Plain]> {
  const out: Record<string, [Plain, Plain]> = {};
  const prev = before as Record<string, unknown>;
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    const [a, b] = [plain(prev[key]), plain(value)];
    if (a !== b) out[key] = [a, b];
  }
  return out;
}

/**
 * Riwayat yang boleh dilihat: entri dinilai dari wilayah paling spesifik yang tercatat.
 * Entri tanpa wilayah sama sekali (mis. user, kategori) hanya untuk SUPER_ADMIN.
 */
export function auditScopeWhere(s: Scope): Prisma.AuditLogWhereInput | undefined {
  if (s.all) return undefined;
  return {
    OR: [
      { kelompokId: { in: [...s.manageKelompok] } },
      { kelompokId: null, desaId: { in: [...s.manageDesa] } },
      { kelompokId: null, desaId: null, daerahId: { in: [...s.manageDaerah] } },
    ],
  };
}
