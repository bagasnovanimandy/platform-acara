import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class LoginDto extends createZodDto(
  z.object({
    email: z.email().transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(200),
  }),
) {}
