# platform-acara

Platform acara & absensi ngaji: jadwal, rundown, absensi face recognition offline, operator per pintu, izin via bot WhatsApp, rekap HADIR/IZIN/SAKIT/ALPHA. SiKU bergabung sebagai service keuangan.

## Mulai dari sini
1. Baca **docs/HANDOVER.md** (arsitektur, data, alur, roadmap).
2. Agen coding wajib mengikuti **AGENTS.md**.
3. Kerjakan fase berurutan memakai prompt di **docs/PROMPTS.md**.
4. Pantau kemajuan di **docs/PROGRESS.md**.

## Isi folder saat ini
```
AGENTS.md                         aturan untuk Codex / OpenCode / Claude Code
docs/HANDOVER.md                  dokumen utama
docs/PROMPTS.md                   prompt siap pakai per fase (0–9)
docs/PROGRESS.md                  checklist & log
services/core/prisma/schema.prisma    draft skema core
services/acara/prisma/schema.prisma   draft skema acara
services/wabot/prisma/schema.prisma   draft skema bot WA
services/*/prisma.config.ts       koneksi DB Prisma 7+ (DATABASE_URL dari .env)
infra/docker-compose.dev.yml      PostgreSQL + Redis untuk dev
infra/postgres-init.sql           membuat core_db, acara_db, wabot_db
```

## Langkah pertama
```bash
git init
docker compose -f infra/docker-compose.dev.yml up -d
# lalu jalankan prompt Fase 0 dari docs/PROMPTS.md di Codex/OpenCode
```

## Prasyarat
Node.js 22, pnpm 9+, Docker.
