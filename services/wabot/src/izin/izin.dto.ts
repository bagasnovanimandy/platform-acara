import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ListIzinQuery extends createZodDto(
  z.object({
    status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    acaraId: z.string().optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

export class DecideIzinDto extends createZodDto(
  z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    catatan: z.string().trim().max(300).optional(),
  }),
) {}
