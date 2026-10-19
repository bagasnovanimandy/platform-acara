import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  CORE_URL: z.string().default('http://localhost:3001'),
  INTERNAL_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('core-svc'),
  JWT_AUDIENCE: z.string().default('platform-acara'),
  UPLOAD_DIR: z.string().default('data/uploads'),
  /** Rahasia HS256 untuk token operator (perangkat pintu). Wajib diganti di produksi. */
  OPERATOR_JWT_SECRET: z.string().min(16).default('dev-operator-secret-ganti-di-produksi'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function config(): AppConfig {
  cached ??= envSchema.parse(process.env);
  return cached;
}
