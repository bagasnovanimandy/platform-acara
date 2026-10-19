import { normalizeWa } from '@platform-acara/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';

/** Nomor WA opsional: dinormalisasi ke 62…, string kosong = hapus. */
export const noWaField = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (v == null || v.trim() === '') return null;
    const n = normalizeWa(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Nomor WA tidak valid' });
      return z.NEVER;
    }
    return n;
  });

const fields = {
  nama: z.string().trim().min(1).max(100),
  jenisKelamin: z.enum(['L', 'P']),
  tanggalLahir: z.iso.date().nullish(),
  /** Id kategori (boleh banyak); diisi manual dari assessment. Dikirim = ganti semua. */
  kategoriIds: z.array(z.string().min(1)).max(20),
  noWa: noWaField,
  status: z.enum(['AKTIF', 'PINDAH', 'NONAKTIF']),
  fotoUrl: z.url().nullish(),
};

export class CreateAnggotaDto extends createZodDto(
  z.object({
    ...fields,
    status: fields.status.default('AKTIF'),
    kategoriIds: fields.kategoriIds.default([]),
    kelompokId: z.string().min(1),
  }),
) {}

/** Pindah kelompok lewat /anggota/:id/mutasi, bukan PATCH. */
export class UpdateAnggotaDto extends createZodDto(z.object(fields).partial()) {}

export class ListAnggotaQuery extends createZodDto(
  paginationSchema.extend({
    q: z.string().trim().optional(),
    daerahId: z.string().optional(),
    desaId: z.string().optional(),
    kelompokId: z.string().optional(),
    status: z.enum(['AKTIF', 'PINDAH', 'NONAKTIF']).optional(),
    jenisKelamin: z.enum(['L', 'P']).optional(),
    /** Id kategori, atau `BELUM` = anggota yang belum punya kategori. */
    kategoriId: z.string().min(1).optional(),
  }),
) {}

export class MutasiDto extends createZodDto(
  z.object({
    keKelompokId: z.string().min(1),
    tanggal: z.iso.date(),
    catatan: z.string().trim().max(300).optional(),
  }),
) {}

export class ImportQuery extends createZodDto(
  z.object({
    dryRun: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((v) => v === 'true' || v === '1'),
  }),
) {}
