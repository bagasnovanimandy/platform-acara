import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ImporSikuSchema = z.object({
  dryRun: z.boolean().default(false),
  users: z
    .array(
      z.object({
        email: z.email().transform((v) => v.trim().toLowerCase()),
        nama: z.string().trim().min(1).max(150),
        sikuRoles: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/)).max(20),
        /** Hash bcrypt dari SiKU, agar user bisa login core dengan password yang sama. */
        passwordHash: z
          .string()
          .regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/)
          .optional(),
        aktif: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(2000),
});

export class ImporSikuDto extends createZodDto(ImporSikuSchema) {}
