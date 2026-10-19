import { KATEGORI_WARNA } from '@platform-acara/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const fields = {
  nama: z.string().trim().min(1).max(50),
  warna: z.enum(KATEGORI_WARNA),
  urutan: z.number().int().min(0).max(10_000),
  aktif: z.boolean(),
};

export class CreateKategoriDto extends createZodDto(
  z.object({
    ...fields,
    warna: fields.warna.default('slate'),
    urutan: fields.urutan.optional(),
    aktif: fields.aktif.default(true),
  }),
) {}

/** Kode tidak bisa diubah (dipakai acara-svc); nama boleh diganti. */
export class UpdateKategoriDto extends createZodDto(z.object(fields).partial()) {}
