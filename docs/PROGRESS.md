# PROGRESS

Diperbarui oleh agen coding setiap selesai satu tugas.

## Status fase
- [x] 0. Fondasi
- [ ] 1. Core
- [ ] 2. Acara
- [ ] 3. Absensi offline
- [ ] 4. Operator & monitoring
- [ ] 5. Enrollment & verifikasi
- [ ] 6. Rekap
- [ ] 7. WA bot & izin
- [ ] 8. Integrasi SiKU
- [ ] 9. Deploy

## Log
<!-- format: YYYY-MM-DD — fase — ringkasan perubahan -->
- 2026-10-19 — 0 — Monorepo pnpm + Turborepo; core/acara/wabot (NestJS 11 + Prisma 7 adapter-pg, GET /health cek DB); apps/web Next.js 15 + Tailwind 4 + shadcn/ui (placeholder /admin, /op, /pengurus); packages/shared (normalizeWa + test, events.ts zod); packages/face (kosong); ESLint 9 + Prettier; CI GitHub Actions. Diverifikasi: `pnpm dev` → keempat health 200, lint/typecheck/test/build lulus.

## Keputusan
<!-- keputusan baru yang tidak ada di HANDOVER, beserta alasannya -->
- Generator Prisma memakai `prisma-client` (bukan `prisma-client-js` yang deprecated di Prisma 7), output `src/generated/prisma`, format CJS, karena NestJS dikompilasi ke CommonJS.
- `/health` mengembalikan 503 `{code: "DB_DOWN"}` bila database mati, supaya healthcheck Docker/Traefik nanti bermakna.
- Test memakai Vitest di semua paket (lebih ringan dari Jest).
- `packages/shared` dan `packages/face` di-build ke `dist/` (CJS) agar bisa dipakai NestJS; Next.js memakai `transpilePackages`.
- Nama queue BullMQ per consumer: `core-events`, `acara-events`, `wabot-events` (`QUEUES` dan `EVENT_ROUTES` di events.ts).
- Prettier tidak memformat `*.md` dan `infra/` agar dokumen asli tidak berubah.

## Tertunda / masalah
- Skema Prisma belum punya migrasi (masih draft). Migrasi pertama dibuat di fase 1.
- shadcn/ui di-init manual (components.json, `cn()`, Button); komponen lain ditambah dengan `pnpm dlx shadcn@latest add <nama>` dari apps/web.
- Celah skema untuk fase 2–6: `Tamu` belum berelasi ke `Sesi`; `Absensi.faceDataId` belum punya foreign key ke `FaceData`.
