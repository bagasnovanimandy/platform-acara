# platform-acara

Platform acara & absensi ngaji: jadwal, rundown, absensi face recognition offline, operator per pintu, izin via bot WhatsApp, rekap HADIR/IZIN/SAKIT/ALPHA. SiKU bergabung sebagai service keuangan.

## Mulai dari sini
1. Baca **docs/HANDOVER.md** (arsitektur, data, alur, roadmap).
2. Agen coding wajib mengikuti **AGENTS.md**.
3. Kerjakan fase berurutan memakai prompt di **docs/PROMPTS.md**.
4. Pantau kemajuan di **docs/PROGRESS.md**.

## Struktur
```
apps/web/            Next.js 15: /admin, /op (PWA operator offline), GET /api/health
services/core/       NestJS core-svc  :3001  (GET /health)
services/acara/      NestJS acara-svc :3002  (acara, sesi, rundown, PJ, foto)
services/wabot/      NestJS wabot-svc :3003  (bot WhatsApp Baileys, izin)
packages/shared/     normalizeWa(), events.ts (nama event + zod schema)
packages/face/       wrapper face-api: loadModels, detectOne, pose, matcher, blur
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
pnpm db:deploy     # terapkan migrasi (core_db, acara_db, wabot_db)
pnpm db:seed       # SUPER_ADMIN + wilayah & 40 anggota contoh
pnpm dev
```
Buka http://localhost:3000/login dan masuk dengan `admin@platform-acara.local` / `admin12345`
(ubah lewat `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` di `services/core/.env`).
Contoh peran lain (password `contoh12345`): `admin.daerah@…`, `admin.selatan@…` (admin desa), `auditor@…` (auditor daerah), semua `@platform-acara.local`.

Cek: `curl localhost:3001/health` (juga 3002, 3003) dan `curl localhost:3000/api/health`.
`/health` service mengembalikan 503 bila database tidak terhubung.

Operator (`/op`): di detail acara buka tab Pintu → isi jumlah → "Buat pintu", lalu cetak kartu. HP pintu memindai QR (sekali pakai, 24 jam) atau membuka `/op` dan mengisi kode pintu + PIN. Tab Pintu juga memantau tiap perangkat secara langsung.
Setelah Cari Nama untuk anggota yang belum punya wajah, pintu menawarkan "Daftarkan wajah" (5 pose otomatis); wajah langsung dipakai dan menunggu verifikasi admin di menu Wajah.
Model wajah disalin otomatis ke `apps/web/public/models` saat `dev`/`build`. Mode offline (service worker) hanya aktif di build produksi (`pnpm build` lalu `next start`).
`OPERATOR_JWT_SECRET` di `services/acara/.env` wajib diganti di produksi.

Bot WhatsApp (`services/wabot`): `WA_DRIVER=fake` (bawaan dev) tidak tersambung ke WhatsApp; pesan masuk bisa dicoba dengan `POST /wa/simulasi {noWa, teks}` + header `x-internal-key`. Untuk nomor sungguhan pakai `WA_DRIVER=baileys`, lalu super admin membuka menu WhatsApp di web dan memindai QR dari WhatsApp nomor bot (Perangkat tertaut). Kredensial disimpan di `WA_AUTH_DIR` (produksi: volume `/data/wa-auth`), jangan di-commit. Anggota atau wali mengirim pesan apa saja ke nomor bot untuk membuka menu izin; PJ izin acara (atau pengurus kelompok bila acara tidak punya PJ izin) menerima pengajuan dan membalas `SETUJU 0123` / `TOLAK 0123 <catatan>`, atau memutuskan di menu Izin. Nomor WA pengurus diisi di menu Pengguna.

Perintah lain: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.
Uji end-to-end core (service harus jalan + data seed): `pnpm --filter @platform-acara/core test:e2e`.
Uji end-to-end acara (core + acara jalan): `pnpm --filter @platform-acara/acara test:e2e`.
Uji end-to-end bot & izin (core + acara + wabot dengan `WA_DRIVER=fake`): `pnpm --filter @platform-acara/wabot test:e2e`.

Mengubah skema core: edit `services/core/prisma/schema.prisma`, lalu
`pnpm --filter @platform-acara/core db:migrate --name <nama>`.
Skema acara dan wabot sama: `pnpm --filter @platform-acara/acara db:migrate --name <nama>` (atau `@platform-acara/wabot`).

## API core (ringkas)
Lewat web: `/api/core/*` diteruskan ke core-svc (rewrite Next.js; di produksi oleh Traefik).
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/.well-known/jwks.json`
- `GET /wilayah/tree`, `GET|POST|PATCH /wilayah/daerah|desa|kelompok`
- `GET|POST|PATCH /anggota` (filter `kategoriId`, `BELUM` = tanpa kategori), `GET /anggota/:id/riwayat`, `POST /anggota/:id/mutasi`, `POST /anggota/import?dryRun=true`, `GET /anggota/import/template`
- `GET|POST|PATCH /wali`, `POST /wali/:id/anak`
- `GET|POST|PATCH /kategori` (ubah: SUPER_ADMIN / admin daerah)
- `GET|POST|PATCH /users` (SUPER_ADMIN semua; ADMIN untuk pengguna di dalam wilayahnya)
- `GET /audit` (riwayat perubahan; ADMIN, AUDITOR, sesuai wilayah)
- `GET /dashboard/ringkasan` (ADMIN, PENGURUS, AUDITOR), `GET /dashboard/audit` (ADMIN, AUDITOR); sesuai wilayah
- `GET /internal/anggota?ids=…`, `GET /internal/wilayah`, `GET /internal/users?ids=…`, `GET /internal/users/:id/scope`, `GET /internal/setting?prefix=…` (header `x-internal-key`)

## API acara (ringkas)
Lewat web: `/api/acara/*` → acara-svc. Token sama dengan core.
- `GET|POST /acara` (filter `q`, `status`, `tingkat`, `dari`/`sampai`), `GET|PATCH|DELETE /acara/:id`
- `POST /acara/peserta/preview` (hitung peserta sebelum simpan), `GET /acara/:id/peserta`
- `POST /acara/:id/sesi`, `PATCH|DELETE /sesi/:id`, `POST /sesi/:id/rundown`, `PUT /sesi/:id/rundown/urutan`, `PATCH|DELETE /rundown/:id`
- `POST /acara/:id/pj`, `DELETE /acara/:id/pj/:pjId`
- `GET|POST /acara/:id/foto`, `GET /foto/:id/file?thumb=1`, `DELETE /foto/:id`
- `GET /anggota/:id/acara` (acara yang diikuti), `GET /anggota-ref/cari?q=`
- `GET /dashboard/acara` (statistik acara sesuai wilayah)
- `POST /sesi/:id/operator/generate {jumlah}` (ADMIN), `GET /sesi/:id/operator`, `GET /sesi/:id/monitor` (SSE), `POST /operator/:id/revoke|reset-pin` (ADMIN), `GET /sesi/:id/kehadiran`
- Perangkat pintu (token operator, bukan token pengguna): `POST /op/login {token}` atau `{kode, pin}`, `GET /op/paket`, `POST /op/heartbeat`, `POST /op/absensi/batch`, `POST /op/tamu`, `POST /op/face/enroll`
- `GET /face/pending`, `GET /face/pending/jumlah`, `GET /face/pending/stream` (SSE), `GET /face/:id`, `GET /face/:id/thumb/:i`, `POST /face/:id/verify|reject|reassign` (ADMIN, sesuai wilayah anggota)
- `GET /sesi/:id/rekap`, `GET /acara/:id/rekap` (filter `?kelompokId|desaId|daerahId`), `GET /sesi/:id/rekap.xlsx`, `GET /acara/:id/rekap.xlsx`, `GET /anggota/:id/kehadiran`, `GET /dashboard/kehadiran`
- `POST /sesi/:id/tutup`, `POST /sesi/:id/rekap/hitung-ulang`, `POST /sesi/:id/absensi` (absen susulan) (ADMIN)
- `POST /sync/anggota?full=true` (SUPER_ADMIN, sinkron ulang salinan anggota)

## API wabot (ringkas)
Lewat web: `/api/wabot/*`.
- `GET /izin?status=&acaraId=&q=`, `GET /izin/jumlah` (ADMIN/PENGURUS/AUDITOR, sesuai wilayah atau penerima pengajuan), `POST /izin/:id/decide {status: APPROVED|REJECTED, catatan?}` (ADMIN/PENGURUS)
- `GET /wa/status` (ADMIN), `POST /wa/pair` (SUPER_ADMIN, QR baru), `GET /wa/pesan?noWa=` (SUPER_ADMIN, log pesan)
- `POST /wa/simulasi` (hanya `WA_DRIVER=fake`, header `x-internal-key`), `POST /sync/anggota?full=true` (SUPER_ADMIN)

Error selalu `{ code, message, details? }`.

## Prasyarat
Node.js 22, pnpm 10, Docker.
