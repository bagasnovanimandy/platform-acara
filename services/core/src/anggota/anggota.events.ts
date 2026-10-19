import type { EventPayload } from '@platform-acara/shared';
import { toIsoDate } from '../common/dates.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Include Prisma yang dibutuhkan untuk membangun payload anggota.upserted. */
export const anggotaEventInclude = {
  kelompok: { include: { desa: { include: { daerah: true } } } },
  wali: { include: { wali: { select: { noWa: true } } } },
} satisfies Prisma.AnggotaInclude;

export type AnggotaWithWilayah = Prisma.AnggotaGetPayload<{ include: typeof anggotaEventInclude }>;

export function toAnggotaUpserted(a: AnggotaWithWilayah): EventPayload<'anggota.upserted'> {
  return {
    id: a.id,
    kode: a.kode,
    nama: a.nama,
    jk: a.jenisKelamin,
    tglLahir: toIsoDate(a.tanggalLahir),
    kelompokId: a.kelompokId,
    desaId: a.kelompok.desaId,
    daerahId: a.kelompok.desa.daerahId,
    namaKelompok: a.kelompok.nama,
    namaDesa: a.kelompok.desa.nama,
    namaDaerah: a.kelompok.desa.daerah.nama,
    status: a.status,
    noWa: a.noWa,
    waliNoWa: a.wali.map((w) => w.wali.noWa),
  };
}
