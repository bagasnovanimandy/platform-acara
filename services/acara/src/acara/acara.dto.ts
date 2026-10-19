import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';

const waktu = z.iso.datetime({ offset: true });
const wilayah = z.object({ level: z.enum(['DAERAH', 'DESA', 'KELOMPOK']), id: z.string().min(1) });

/** Siapa yang ikut: wilayah (satu atau gabungan) × kategori × jenis kelamin. */
export const pesertaSchema = z.object({
  tingkat: z.enum(['KELOMPOK', 'DESA', 'DAERAH', 'GABUNGAN']),
  wilayah: z.array(wilayah).min(1).max(200),
  jenisKelamin: z.enum(['L', 'P']).nullish(),
  /** Kode kategori dari core; kosong = semua kategori. */
  kategori: z
    .array(z.string().regex(/^[A-Z0-9_]+$/, 'Kode kategori tidak valid'))
    .max(50)
    .default([]),
});

const fields = {
  nama: z.string().trim().min(1).max(150),
  jenis: z.string().trim().min(1).max(60),
  deskripsi: z.string().trim().max(2000).nullish(),
  lokasi: z.string().trim().max(200).nullish(),
  tanggalMulai: waktu,
  tanggalSelesai: waktu,
  status: z.enum(['DRAFT', 'TERJADWAL', 'BERLANGSUNG', 'SELESAI', 'BATAL']),
};

export class PreviewPesertaDto extends createZodDto(pesertaSchema) {}

export class CreateAcaraDto extends createZodDto(
  z.object({ ...fields, status: fields.status.default('DRAFT'), ...pesertaSchema.shape }),
) {}

/** Mengirim `tingkat` + `wilayah` (+ kategori/jenisKelamin) = ganti aturan peserta. */
export class UpdateAcaraDto extends createZodDto(
  z.object({ ...fields, ...pesertaSchema.shape }).partial(),
) {}

export class ListAcaraQuery extends createZodDto(
  paginationSchema.extend({
    q: z.string().trim().optional(),
    status: z.enum(['DRAFT', 'TERJADWAL', 'BERLANGSUNG', 'SELESAI', 'BATAL']).optional(),
    tingkat: z.enum(['KELOMPOK', 'DESA', 'DAERAH', 'GABUNGAN']).optional(),
    /** Rentang tanggal (untuk kalender): acara yang bersinggungan dengan [dari, sampai]. */
    dari: waktu.optional(),
    sampai: waktu.optional(),
  }),
) {}

export class ListPesertaQuery extends createZodDto(
  paginationSchema.extend({ q: z.string().trim().optional() }),
) {}

export class CreatePjDto extends createZodDto(
  z.object({
    userId: z.string().min(1),
    peran: z.enum(['PJ_UMUM', 'PJ_IZIN', 'PJ_ABSENSI', 'PJ_DOKUMENTASI', 'LAINNYA']),
    keterangan: z.string().trim().max(200).nullish(),
  }),
) {}

export class CariAnggotaQuery extends createZodDto(
  z.object({
    q: z.string().trim().min(2),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
) {}
