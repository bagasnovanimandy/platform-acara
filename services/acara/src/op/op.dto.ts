import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const perangkat = z.string().max(200).optional();

/** Login perangkat: token QR sekali pakai, atau kode pintu + PIN. */
export class OpLoginDto extends createZodDto(
  z
    .object({
      token: z.string().min(16).max(200).optional(),
      kode: z
        .string()
        .trim()
        .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .pipe(z.string().length(6, 'Kode pintu 6 karakter'))
        .optional(),
      pin: z
        .string()
        .regex(/^\d{6}$/, 'PIN 6 angka')
        .optional(),
      perangkat,
    })
    .refine((d) => d.token || (d.kode && d.pin), 'Isi token QR, atau kode pintu dan PIN'),
) {}

export class HeartbeatDto extends createZodDto(
  z.object({
    online: z.boolean(),
    sedangInput: z.boolean(),
    antrean: z.number().int().min(0).max(100_000),
    baterai: z.number().int().min(0).max(100).nullish(),
    perangkat,
  }),
) {}

export class GeneratePintuDto extends createZodDto(
  z.object({ jumlah: z.number().int().min(1).max(20) }),
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
