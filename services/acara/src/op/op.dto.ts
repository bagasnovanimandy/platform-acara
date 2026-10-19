import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class OpLoginDto extends createZodDto(
  z.object({ token: z.string().min(16).max(200), perangkat: z.string().max(200).optional() }),
) {}

const waktu = z.iso.datetime({ offset: true });

export const absensiItemSchema = z.discriminatedUnion('metode', [
  z.object({
    clientId: z.uuid(),
    metode: z.literal('WAJAH'),
    anggotaId: z.string().min(1),
    faceDataId: z.string().min(1).nullish(),
    faceDistance: z.number().min(0).max(2).nullish(),
    capturedAt: waktu,
  }),
  z.object({
    clientId: z.uuid(),
    metode: z.literal('MANUAL'),
    anggotaId: z.string().min(1),
    capturedAt: waktu,
  }),
  z.object({
    clientId: z.uuid(),
    metode: z.literal('TAMU'),
    nama: z.string().trim().min(1).max(100),
    keterangan: z.string().trim().max(200).nullish(),
    capturedAt: waktu,
  }),
]);
export type AbsensiItem = z.infer<typeof absensiItemSchema>;

export class AbsensiBatchDto extends createZodDto(
  z.object({ items: z.array(absensiItemSchema).min(1).max(500) }),
) {}

export class TamuDto extends createZodDto(
  z.object({
    clientId: z.uuid(),
    nama: z.string().trim().min(1).max(100),
    keterangan: z.string().trim().max(200).nullish(),
    capturedAt: waktu,
  }),
) {}
