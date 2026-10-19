import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { noWaField } from '../anggota/anggota.dto.js';
import { paginationSchema } from '../common/pagination.js';

const requiredNoWa = noWaField.refine((v): v is string => v !== null, 'Nomor WA wajib diisi');
const hubungan = z.enum(['AYAH', 'IBU', 'WALI']);

export class CreateWaliDto extends createZodDto(
  z.object({
    nama: z.string().trim().min(1).max(100),
    noWa: requiredNoWa,
    anak: z.array(z.object({ anggotaId: z.string().min(1), hubungan })).default([]),
  }),
) {}

export class UpdateWaliDto extends createZodDto(
  z.object({ nama: z.string().trim().min(1).max(100), noWa: requiredNoWa }).partial(),
) {}

export class LinkAnakDto extends createZodDto(
  z.object({ anggotaId: z.string().min(1), hubungan }),
) {}

export class ListWaliQuery extends createZodDto(
  paginationSchema.extend({ q: z.string().trim().optional() }),
) {}
