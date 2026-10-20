import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';

/** Data URL / base64 gambar; ukuran diperiksa lagi saat decode. */
const gambar = z
  .string()
  .max(400_000)
  .transform((s) => s.replace(/^data:image\/[a-z]+;base64,/, ''))
  .pipe(z.base64());

export class EnrollDto extends createZodDto(
  z.object({
    clientId: z.uuid(),
    anggotaId: z.string().min(1),
    descriptors: z.array(z.array(z.number().finite()).length(128)).length(5),
    thumbnails: z.array(gambar).length(5),
    capturedAt: z.iso.datetime({ offset: true }),
  }),
) {}

export class TolakWajahDto extends createZodDto(
  z.object({ alasan: z.string().trim().max(300).optional() }),
) {}

export class GantiAnggotaDto extends createZodDto(z.object({ anggotaId: z.string().min(1) })) {}

export class PendingQuery extends createZodDto(paginationSchema) {}
