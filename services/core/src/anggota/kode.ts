import type { Prisma } from '../generated/prisma/client.js';

/** Kode anggota: `<kodeDesa>-<urut 4 digit>`, mis. `JS-0001`. */
export function formatKodeAnggota(kodeDesa: string, urut: number): string {
  return `${kodeDesa}-${String(urut).padStart(4, '0')}`;
}

/** Ambil nomor urut berikutnya untuk desa secara atomik (aman dipanggil bersamaan). */
export async function nextUrut(tx: Prisma.TransactionClient, desaId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "KodeCounter" ("desaId", "last") VALUES (${desaId}, 1)
    ON CONFLICT ("desaId") DO UPDATE SET "last" = "KodeCounter"."last" + 1
    RETURNING "last"`;
  const last = rows[0]?.last;
  if (last === undefined) throw new Error('Gagal membuat nomor urut anggota');
  return last;
}
