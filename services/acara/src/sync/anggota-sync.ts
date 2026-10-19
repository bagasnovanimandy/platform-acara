import type { EventPayload } from '@platform-acara/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Payload anggota.upserted → baris AnggotaRef. */
export function toAnggotaRef(a: EventPayload<'anggota.upserted'>): Prisma.AnggotaRefCreateInput {
  return {
    id: a.id,
    kode: a.kode,
    nama: a.nama,
    jenisKelamin: a.jk,
    tanggalLahir: a.tglLahir ? new Date(`${a.tglLahir}T00:00:00.000Z`) : null,
    kelompokId: a.kelompokId,
    desaId: a.desaId,
    daerahId: a.daerahId,
    namaKelompok: a.namaKelompok,
    namaDesa: a.namaDesa,
    namaDaerah: a.namaDaerah,
    status: a.status,
    kategori: a.kategori,
    updatedAt: new Date(a.updatedAt),
    syncedAt: new Date(),
  };
}
