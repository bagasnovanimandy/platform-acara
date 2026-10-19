# Prompt per Fase (untuk Codex / OpenCode)

Salin satu prompt per sesi kerja. Semua prompt mengasumsikan agen sudah membaca `AGENTS.md` dan `docs/HANDOVER.md`.

---

## Fase 0 — Fondasi
```
Baca AGENTS.md dan docs/HANDOVER.md (§2, §3, §7 fase 0).
Buat monorepo pnpm + Turborepo dengan struktur folder sesuai HANDOVER §3:
- apps/web: Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui init), halaman placeholder /admin, /op, /pengurus.
- services/core, services/acara, services/wabot: NestJS, masing-masing dengan Prisma (pakai schema draft yang sudah ada di prisma/schema.prisma), endpoint GET /health, port 3001/3002/3003.
- packages/shared: tsconfig base, util normalizeWa() + test, file events.ts berisi nama event & zod schema payload sesuai HANDOVER §2 (tabel Event).
- packages/face: paket kosong dengan index.ts (diisi fase 3).
- infra/docker-compose.dev.yml sudah ada (postgres + redis); pastikan script init membuat core_db, acara_db, wabot_db.
- Script root: dev, build, lint, typecheck, test. ESLint + Prettier bersama.
- .env.example per service.
Selesai bila `pnpm dev` menjalankan web + 3 service dan semua /health mengembalikan 200. Perbarui docs/PROGRESS.md.
```

## Fase 1 — Core
```
Baca AGENTS.md dan docs/HANDOVER.md (§2 Auth, §4 core_db, §6 core-svc, §7 fase 1).
Implementasikan core-svc:
1. Auth: login email+password (argon2), JWT RS256 (access 15 menit, refresh 7 hari), endpoint JWKS, GET /auth/me. Guard role + guard scope wilayah.
2. CRUD Daerah/Desa/Kelompok.
3. CRUD Anggota dengan filter wilayah, pencarian nama/kode, pagination. Kode anggota dibuat otomatis <kodeDesa>-<urut 4 digit>.
4. Wali + relasi AnggotaWali.
5. POST /anggota/import menerima xlsx kolom: Nama, JK, Tgl Lahir, No WA, No WA Ortu, Nama Ortu, Kelompok, Desa, Daerah. Cocokkan nama wilayah ke ID (case-insensitive, trim); laporkan baris gagal. Mode dry-run.
6. Mutasi sambung: ubah kelompokId + catat MutasiSambung.
7. Publish event anggota.upserted & anggota.mutasi ke BullMQ (queue acara & wabot).
8. Seed: 1 SUPER_ADMIN, 1 daerah, 2 desa, 4 kelompok, 40 anggota dummy.
Di apps/web: halaman login, /admin/wilayah, /admin/anggota (tabel, form cascading Daerah→Desa→Kelompok, import Excel dengan pratinjau).
Tulis test untuk import & scope guard. Perbarui docs/PROGRESS.md.
```

## Fase 2 — Acara
```
Baca AGENTS.md dan docs/HANDOVER.md (§4 acara_db, §5.1, §6 acara-svc, §7 fase 2).
Implementasikan di acara-svc:
1. Consumer event anggota.upserted/anggota.mutasi → upsert AnggotaRef.
2. CRUD Acara, Sesi, RundownItem (dengan urutan drag-sort), Pengisi, AcaraPJ, PesertaRule.
3. Hitung peserta dari PesertaRule (preview jumlah), kategori usia dari tanggal lahir memakai batas di Setting (ambil via core internal endpoint, cache 10 menit).
4. Upload foto kegiatan: terima WebP hasil kompres browser, simpan ke /data/uploads/acara/<id>/, buat thumbnail 320px dengan sharp.
5. Verifikasi JWT dari core via JWKS.
Di apps/web: /admin/acara (list + kalender sederhana), detail acara dengan tab Sesi, Rundown, PJ, Peserta, Foto. Cetak rundown (halaman print-friendly).
Perbarui docs/PROGRESS.md.
```

## Fase 3 — Absensi offline
```
Baca AGENTS.md dan docs/HANDOVER.md (§5.3, §5.4, §7 fase 3).
1. packages/face: loadModels(baseUrl), detectOne(video) → {box, landmarks, descriptor, score}, estimatePose(landmarks) (rumus §5.5), createMatcher(entries, threshold), blurScore(canvas). Tulis unit test untuk estimatePose dengan landmark sintetis.
2. Salin model face-api (tiny_face_detector, face_landmark_68_tiny, face_recognition) ke apps/web/public/models.
3. acara-svc: GET /op/paket (peserta sesi + embedding VERIFIED & PENDING, tanpa data pribadi), POST /op/absensi/batch (idempoten clientId; simpan capturedAt paling awal; sisanya ke AbsensiDuplikat), POST /op/tamu. Sementara pakai token operator dummy (fase 4 membuat yang asli).
4. apps/web /op: PWA (Serwist) yang meng-cache app shell + model. Dexie DB: paket, antreanAbsensi, enrollments. Layar scan full-screen: video 640x480, pilih kamera (enumerateDevices, simpan di localStorage), deteksi tiap 400 ms, hasil cocok → kartu hijau 1,5 dtk, cooldown 60 dtk per anggota. Tombol besar "Cari Nama" (pencarian fuzzy offline dari paket) dan "Tamu". Indikator online/offline + jumlah antrean. Sinkron tiap 5 dtk saat online.
Selesai bila: dengan DevTools Offline, 30 absensi tersimpan, lalu online → tersinkron tanpa duplikat. Perbarui docs/PROGRESS.md.
```

## Fase 4 — Operator & monitoring
```
Baca AGENTS.md dan docs/HANDOVER.md (§2 Auth operator, §5.2, §5.7, §7 fase 4).
1. acara-svc: POST /sesi/:id/operator/generate {jumlah} → buat OperatorSession (label "Pintu N", PIN 6 digit di-hash argon2, qrToken acak). Respons sekali menampilkan PIN polos.
2. POST /op/login: via qrToken (sekali pakai) atau PIN + sesiId; terbitkan JWT operator (exp = sesi.selesai + 2 jam). Guard menolak bila revoked/expired.
3. POST /operator/:id/revoke dan /reset-pin.
4. POST /op/heartbeat tiap 20 dtk → update lastSeenAt, antrean, perangkat. lastScanAt diupdate saat batch absensi.
5. GET /sesi/:id/monitor (SSE): kirim snapshot status operator tiap perubahan / tiap 10 dtk.
6. apps/web: halaman sesi → tab Operator: input jumlah pintu, tombol Generate, kartu cetak QR (layout A4, 4 per halaman, berisi label, QR, PIN), tombol cabut/reset. Tab Monitor: kartu per pintu (Online/Idle/Offline sesuai aturan §5.7, jumlah input, scan terakhir, antrean, perangkat); klik → daftar absensi operator itu.
7. Ganti token dummy fase 3 dengan login asli; layar /op/login (scan QR via kamera atau isi PIN).
Perbarui docs/PROGRESS.md.
```

## Fase 5 — Enrollment & verifikasi
```
Baca AGENTS.md dan docs/HANDOVER.md (§5.5, §5.6, §7 fase 5).
1. apps/web /op: komponen GuidedEnrollment: lingkaran panduan, urutan pose Lurus→Kiri→Kanan→Atas→Bawah, auto-capture saat pose sesuai & stabil 300 ms, cek kualitas (skor ≥0.8, lebar wajah ≥25%, blur), pesan bantuan, progress ring 5 segmen. Kalibrasi pitch dari pose Lurus. Perhatikan mirror kamera depan.
2. Hasil: 5 descriptor + 5 thumbnail 160px WebP → simpan Dexie → langsung ditambahkan ke matcher lokal → anggota otomatis hadir → masuk antrean sinkron.
3. Alur dari "Cari Nama": setelah Hadir manual, tawarkan "Daftarkan wajah sekarang?" (bisa dilewati).
4. acara-svc: POST /op/face/enroll (simpan FaceData PENDING + thumbnails, idempoten clientId), publish face.enrolled. GET /face/pending, POST /face/:id/verify|reject|reassign. Reject → tandai Absensi.perluTinjau untuk absensi dengan faceDataId tsb.
5. Paket offline (/op/paket) menyertakan wajah PENDING milik sesi yang sama.
6. apps/web /admin: badge "N wajah perlu verifikasi" (SSE), halaman verifikasi dengan 5 thumbnail + foto profil + wajah terverifikasi lain, info operator/pintu/waktu, tombol Setujui/Tolak/Ganti anggota.
Perbarui docs/PROGRESS.md.
```

## Fase 6 — Rekap
```
Baca AGENTS.md dan docs/HANDOVER.md (§5.9, §7 fase 6).
1. acara-svc: saat sesi dibuka → snapshot PesertaSesi. POST /sesi/:id/tutup dan cron (selesai + 2 jam) → hitung Rekap sesuai aturan §5.9 sebagai pure function (unit test lengkap). Endpoint hitung ulang.
2. Consumer izin.submitted/izin.decided → upsert IzinRef; bila sesi sudah ditutup, hitung ulang rekap anggota tsb.
3. Absensi susulan oleh admin (metode MANUAL, dicatatAdminId).
4. GET /sesi/:id/rekap (filter status/kelompok), ekspor xlsx & PDF; rekap per acara dan per wilayah.
5. apps/web: tab Rekap dengan ringkasan (jumlah per status), tabel, penanda kuning untuk absensi wajah PENDING / perluTinjau, tombol ekspor.
Perbarui docs/PROGRESS.md.
```

## Fase 7 — WA bot & izin
```
Baca AGENTS.md dan docs/HANDOVER.md (§5.8, §6 wabot-svc, §7 fase 7).
1. wabot-svc: koneksi Baileys, auth state di volume /data/wa-auth, endpoint admin GET /wa/status dan POST /wa/pair (kembalikan QR pairing untuk ditampilkan di web). Reconnect otomatis.
2. Consumer anggota.upserted → KontakRef (nomor anggota & nomor wali).
3. State machine bot sebagai pure function: (state, pesanMasuk, konteks) → {stateBaru, balasan[], efek[]}. State di Redis TTL 10 menit. Alur & teks persis seperti HANDOVER §5.8 (menu bernomor, pilih anak untuk wali, pilih acara 14 hari ke depan via endpoint internal acara-svc, kategori, alasan maks 300 karakter, draft Kirim/Ubah/Batal, kata kunci "menu" & "batal"). Unit test semua transisi.
4. Kirim izin: simpan Izin, publish izin.submitted, teruskan ke PJ_IZIN (fallback pengurus kelompok via core). Pengurus membalas "SETUJU 0123" / "TOLAK 0123 catatan" → validasi pengirim adalah handler → update, publish izin.decided, kabari pengaju.
5. Tolak pengajuan setelah batasIzin sesi.
6. Rate limit balasan (maks 1 pesan/detik per nomor), log PesanLog.
7. apps/web: /admin/wa (status koneksi + QR pairing), /pengurus/izin (daftar izin masuk, tombol setujui/tolak).
Perbarui docs/PROGRESS.md.
```

## Fase 8 — Integrasi SiKU
```
Baca AGENTS.md, docs/HANDOVER.md, dan kode SiKU.
1. Buat endpoint internal di core untuk migrasi user (impor user SiKU dengan role bendahara/ketua/auditor sebagai role tambahan atau claim "siku_role").
2. Ubah SiKU agar menerima JWT dari core (verifikasi JWKS), pertahankan login lama sebagai fallback selama masa transisi (feature flag).
3. Tautkan menu antar aplikasi di apps/web.
Jangan ubah logika keuangan SiKU. Tulis langkah rollback.
```

## Fase 9 — Deploy
```
Baca AGENTS.md dan docs/HANDOVER.md (§9).
Buat infra/docker-compose.prod.yml: postgres, redis, core, acara, wabot, web, traefik, cloudflared; batas memori per container; healthcheck; volume /data/uploads, /data/wa-auth, pgdata.
Dockerfile multi-stage per app (node:22-alpine, pnpm deploy --prod).
Script infra/backup.sh (pg_dumpall + rsync uploads, rotasi 14 hari) + cron; script restore + dokumentasi uji restore.
Dokumentasikan langkah deploy di docs/DEPLOY.md.
```
