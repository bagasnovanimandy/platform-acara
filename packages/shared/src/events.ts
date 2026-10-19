import { z } from 'zod';

/**
 * Satu-satunya tempat definisi nama event & payload BullMQ (HANDOVER §2, tabel Event).
 * Producer mengirim ke queue milik consumer (lihat QUEUES).
 */

export const EVENTS = {
  ANGGOTA_UPSERTED: 'anggota.upserted',
  ANGGOTA_MUTASI: 'anggota.mutasi',
  IZIN_SUBMITTED: 'izin.submitted',
  IZIN_DECIDED: 'izin.decided',
  FACE_ENROLLED: 'face.enrolled',
  SESI_CLOSED: 'sesi.closed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Nama queue per consumer service. */
export const QUEUES = {
  CORE: 'core-events',
  ACARA: 'acara-events',
  WABOT: 'wabot-events',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const id = z.string().min(1);
const isoDate = z.iso.datetime({ offset: true });
const noWa = z.string().regex(/^628\d{8,11}$/, 'Nomor WA harus dinormalisasi ke 62…');

export const anggotaUpsertedSchema = z.object({
  id,
  kode: z.string().min(1),
  nama: z.string().min(1),
  jk: z.enum(['L', 'P']),
  tglLahir: z.iso.date().nullable(),
  /** Kode kategori (mis. REMAJA, IBU_IBU); diisi manual dari assessment, boleh kosong. */
  kategori: z.array(z.string().min(1)),
  kelompokId: id,
  desaId: id,
  daerahId: id,
  namaKelompok: z.string().min(1),
  namaDesa: z.string().min(1),
  namaDaerah: z.string().min(1),
  status: z.enum(['AKTIF', 'PINDAH', 'NONAKTIF']),
  noWa: noWa.nullable(),
  waliNoWa: z.array(noWa),
});

export const anggotaMutasiSchema = z.object({
  anggotaId: id,
  dariKelompokId: id,
  keKelompokId: id,
  tanggal: z.iso.date(),
});

export const izinSubmittedSchema = z.object({
  izinId: id,
  anggotaId: id,
  sesiId: id.optional(),
  acaraId: id,
  kategori: z.enum(['IZIN', 'SAKIT']),
  alasan: z.string().min(1).max(300),
});

export const izinDecidedSchema = z.object({
  izinId: id,
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  decidedBy: id,
  decidedAt: isoDate,
});

export const faceEnrolledSchema = z.object({
  faceDataId: id,
  anggotaId: id,
  operatorLabel: z.string().min(1),
});

export const sesiClosedSchema = z.object({
  sesiId: id,
});

export const eventSchemas = {
  [EVENTS.ANGGOTA_UPSERTED]: anggotaUpsertedSchema,
  [EVENTS.ANGGOTA_MUTASI]: anggotaMutasiSchema,
  [EVENTS.IZIN_SUBMITTED]: izinSubmittedSchema,
  [EVENTS.IZIN_DECIDED]: izinDecidedSchema,
  [EVENTS.FACE_ENROLLED]: faceEnrolledSchema,
  [EVENTS.SESI_CLOSED]: sesiClosedSchema,
} as const satisfies Record<EventName, z.ZodType>;

export type EventPayload<E extends EventName> = z.infer<(typeof eventSchemas)[E]>;

/** Queue tujuan tiap event (consumer). */
export const EVENT_ROUTES = {
  [EVENTS.ANGGOTA_UPSERTED]: [QUEUES.ACARA, QUEUES.WABOT],
  [EVENTS.ANGGOTA_MUTASI]: [QUEUES.ACARA],
  [EVENTS.IZIN_SUBMITTED]: [QUEUES.ACARA],
  [EVENTS.IZIN_DECIDED]: [QUEUES.ACARA],
  [EVENTS.FACE_ENROLLED]: [QUEUES.WABOT],
  [EVENTS.SESI_CLOSED]: [QUEUES.WABOT],
} as const satisfies Record<EventName, readonly QueueName[]>;

/** Validasi payload event; melempar ZodError bila tidak sesuai. */
export function parseEvent<E extends EventName>(name: E, payload: unknown): EventPayload<E> {
  return eventSchemas[name].parse(payload) as EventPayload<E>;
}
