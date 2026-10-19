import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const kode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,20}$/, 'Kode hanya huruf, angka, dan tanda hubung (maks 20)');
const nama = z.string().trim().min(1).max(100);

export class CreateDaerahDto extends createZodDto(z.object({ kode, nama })) {}
export class UpdateDaerahDto extends createZodDto(z.object({ kode, nama }).partial()) {}

export class CreateDesaDto extends createZodDto(
  z.object({ kode, nama, daerahId: z.string().min(1) }),
) {}
export class UpdateDesaDto extends createZodDto(z.object({ kode, nama }).partial()) {}

const kelompokFields = {
  kode,
  nama,
  alamat: z.string().trim().max(300).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
};
export class CreateKelompokDto extends createZodDto(
  z.object({ ...kelompokFields, desaId: z.string().min(1) }),
) {}
export class UpdateKelompokDto extends createZodDto(z.object(kelompokFields).partial()) {}

export class ListDesaQuery extends createZodDto(z.object({ daerahId: z.string().optional() })) {}
export class ListKelompokQuery extends createZodDto(z.object({ desaId: z.string().optional() })) {}
