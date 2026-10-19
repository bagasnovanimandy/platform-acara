import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationSchema } from '../common/pagination.js';

export class ListAuditQuery extends createZodDto(
  paginationSchema.extend({
    entitas: z.string().optional(),
    entitasId: z.string().optional(),
    userId: z.string().optional(),
    aksi: z.string().optional(),
    q: z.string().trim().optional(),
    dari: z.iso.datetime({ offset: true }).optional(),
    sampai: z.iso.datetime({ offset: true }).optional(),
  }),
) {}
