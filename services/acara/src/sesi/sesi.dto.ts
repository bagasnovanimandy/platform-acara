import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const waktu = z.iso.datetime({ offset: true });

const sesiFields = {
  nama: z.string().trim().min(1).max(100),
  mulai: waktu,
  selesai: waktu,
  toleransiMenit: z.number().int().min(0).max(240),
  batasIzin: waktu.nullish(),
};

export class CreateSesiDto extends createZodDto(
  z.object({ ...sesiFields, toleransiMenit: sesiFields.toleransiMenit.default(15) }),
) {}

export class UpdateSesiDto extends createZodDto(z.object(sesiFields).partial()) {}

const pengisi = z
  .object({
    anggotaId: z.string().min(1).nullish(),
    namaBebas: z.string().trim().max(100).nullish(),
    peran: z.string().trim().max(60).nullish(),
  })
  .refine((p) => p.anggotaId || p.namaBebas, 'Pengisi butuh anggota atau nama');

const rundownFields = {
  judul: z.string().trim().min(1).max(150),
  keterangan: z.string().trim().max(1000).nullish(),
  mulai: waktu.nullish(),
  selesai: waktu.nullish(),
  /** Dikirim = ganti semua pengisi item ini. */
  pengisi: z.array(pengisi).max(20),
};

export class CreateRundownDto extends createZodDto(
  z.object({ ...rundownFields, pengisi: rundownFields.pengisi.default([]) }),
) {}

export class UpdateRundownDto extends createZodDto(z.object(rundownFields).partial()) {}

export class UrutanDto extends createZodDto(z.object({ ids: z.array(z.string().min(1)).min(1) })) {}
