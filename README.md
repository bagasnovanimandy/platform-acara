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
cp apps/web/.env.example apps/web/.env.local
pnpm db:generate
pnpm db:deploy     # terapkan migrasi (saat ini: core_db)
pnpm db:seed       # SUPER_ADMIN + wilayah & 40 anggota contoh
pnpm dev
```
Buka http://localhost:3000/login dan masuk dengan `admin@platform-acara.local` / `admin12345`
(ubah lewat `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` di `services/core/.env`).
Contoh peran lain (password `contoh12345`): `admin.daerah@…`, `admin.selatan@…` (admin desa), `auditor@…` (auditor daerah), semua `@platform-acara.local`.

Cek: `curl localhost:3001/health` (juga 3002, 3003) dan `curl localhost:3000/api/health`.
`/health` service mengembalikan 503 bila database tidak terhubung.

Perintah lain: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.
Uji end-to-end core (service harus jalan + data seed): `pnpm --filter @platform-acara/core test:e2e`.

Mengubah skema core: edit `services/core/prisma/schema.prisma`, lalu
`pnpm --filter @platform-acara/core db:migrate --name <nama>`.
Skema acara & wabot masih draft tanpa migrasi; untuk mencoba, `pnpm --filter @platform-acara/<service> exec prisma db push`.

## API core (ringkas)
Lewat web: `/api/core/*` diteruskan ke core-svc (rewrite Next.js; di produksi oleh Traefik).
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/.well-known/jwks.json`
- `GET /wilayah/tree`, `GET|POST|PATCH /wilayah/daerah|desa|kelompok`
- `GET|POST|PATCH /anggota` (filter `kategoriId`, `BELUM` = tanpa kategori), `GET /anggota/:id/riwayat`, `POST /anggota/:id/mutasi`, `POST /anggota/import?dryRun=true`, `GET /anggota/import/template`
- `GET|POST|PATCH /wali`, `POST /wali/:id/anak`
- `GET|POST|PATCH /kategori` (ubah: SUPER_ADMIN / admin daerah)
- `GET|POST|PATCH /users` (SUPER_ADMIN semua; ADMIN untuk pengguna di dalam wilayahnya)
- `GET /audit` (riwayat perubahan; ADMIN, AUDITOR, sesuai wilayah)
- `GET /internal/anggota?ids=…`, `GET /internal/setting?prefix=…` (header `x-internal-key`)

Error selalu `{ code, message, details? }`.

## Prasyarat
Node.js 22, pnpm 10, Docker.
