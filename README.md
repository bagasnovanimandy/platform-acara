# platform-acara

Platform acara & absensi ngaji: jadwal, rundown, absensi face recognition offline, operator per pintu, izin via bot WhatsApp, rekap HADIR/IZIN/SAKIT/ALPHA. SiKU bergabung sebagai service keuangan.

## Mulai dari sini
1. Baca **docs/HANDOVER.md** (arsitektur, data, alur, roadmap).
2. Agen coding wajib mengikuti **AGENTS.md**.
3. Kerjakan fase berurutan memakai prompt di **docs/PROMPTS.md**.
4. Pantau kemajuan di **docs/PROGRESS.md**.

## Struktur
```
apps/web/            Next.js 15: /admin, /op, /pengurus (placeholder), GET /api/health
services/core/       NestJS core-svc  :3001  (GET /health)
services/acara/      NestJS acara-svc :3002  (GET /health)
services/wabot/      NestJS wabot-svc :3003  (GET /health)
packages/shared/     normalizeWa(), events.ts (nama event + zod schema)
packages/face/       wrapper face-api (diisi fase 3)
infra/               docker-compose dev (PostgreSQL 16 + Redis 7)
docs/                HANDOVER, PROMPTS, PROGRESS
```

## Menjalankan (dev)
```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d
for s in core acara wabot; do cp services/$s/.env.example services/$s/.env; done
pnpm db:generate
pnpm dev
```
Cek: `curl localhost:3001/health` (juga 3002, 3003) dan `curl localhost:3000/api/health`.
`/health` service mengembalikan 503 bila database tidak terhubung.

Perintah lain: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.

Skema Prisma masih draft dan belum punya migrasi. Untuk dev, `pnpm --filter @platform-acara/<service> exec prisma db push` menerapkan skema ke database; migrasi pertama dibuat di fase 1.

## Prasyarat
Node.js 22, pnpm 10, Docker.
