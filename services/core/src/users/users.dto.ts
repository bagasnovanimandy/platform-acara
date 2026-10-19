import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { noWaField } from '../anggota/anggota.dto.js';

const scopes = z.array(
  z.object({ level: z.enum(['DAERAH', 'DESA', 'KELOMPOK']), refId: z.string().min(1) }),
);

const fields = {
  nama: z.string().trim().min(1).max(100),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PENGURUS', 'AUDITOR']),
  noWa: noWaField,
  anggotaId: z.string().min(1).nullish(),
  scopes,
};

export class CreateUserDto extends createZodDto(
  z.object({ ...fields, scopes: scopes.default([]) }),
) {}

export class UpdateUserDto extends createZodDto(
  z
    .object({ ...fields, aktif: z.boolean() })
    .omit({ email: true })
    .partial(),
) {}
