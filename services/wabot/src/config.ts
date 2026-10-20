import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  CORE_URL: z.string().default('http://localhost:3001'),
  ACARA_URL: z.string().default('http://localhost:3002'),
  INTERNAL_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('core-svc'),
  JWT_AUDIENCE: z.string().default('platform-acara'),
  /** `baileys` = WhatsApp sungguhan; `fake` = tanpa WA, pesan masuk lewat POST /wa/simulasi. */
  WA_DRIVER: z.enum(['baileys', 'fake']).default('fake'),
  WA_AUTH_DIR: z.string().default('data/wa-auth'),
  /** Jeda minimum antar pesan keluar (ms), agar nomor bot tidak dianggap spam. */
  WA_JEDA_KIRIM_MS: z.coerce.number().int().min(0).default(1500),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function config(): AppConfig {
  cached ??= envSchema.parse(process.env);
  return cached;
}
