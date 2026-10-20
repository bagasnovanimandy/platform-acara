import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const opsional = z.string().min(1).optional();

/** Filter rekap per kelompok/desa/daerah (ekspor per wilayah). */
export class RekapQuery extends createZodDto(
  z.object({ kelompokId: opsional, desaId: opsional, daerahId: opsional }),
) {}

export class SusulanDto extends createZodDto(
  z.object({
    anggotaId: z.string().min(1),
    waktu: z.iso.datetime({ offset: true }).optional(),
    catatan: z.string().trim().max(300).optional(),
  }),
) {}
