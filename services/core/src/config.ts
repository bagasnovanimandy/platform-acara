import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  INTERNAL_KEY: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PRIVATE_KEY_FILE: z.string().default('keys/jwt-private.pem'),
  JWT_ISSUER: z.string().default('core-svc'),
  JWT_AUDIENCE: z.string().default('platform-acara'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  /** Alamat web SiKU (mis. https://siku.example.org). Kosong = tautan SiKU tidak aktif. */
  SIKU_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  SIKU_AUDIENCE: z.string().default('siku'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function config(): AppConfig {
  cached ??= envSchema.parse(process.env);
  return cached;
}
