# PROGRESS

Diperbarui oleh agen coding setiap selesai satu tugas.

## Status fase
- [x] 0. Fondasi
- [x] 1. Core
- [ ] 2. Acara — tahap A (kategori, auditor, riwayat, admin bertingkat) selesai; tahap B (layanan acara + halaman acara) selesai; dashboard admin & auditor di PR terpisah
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
- 2026-10-19 — 1 — core-svc: login argon2 + JWT RS256 (access 15 mnt, refresh 7 hari via cookie httpOnly), JWKS, /auth/me; guard role + scope wilayah; CRUD daerah/desa/kelompok, anggota (filter wilayah, cari, pagination, kode otomatis), wali, mutasi; import xlsx dengan dry-run; event anggota.upserted/anggota.mutasi ke BullMQ; /internal/anggota & /internal/setting; users (SUPER_ADMIN); migrasi pertama core_db; seed. Web: /login, /admin/anggota (tabel, filter bertingkat, tambah/ubah, pindah kelompok), /admin/anggota/import (pratinjau), /admin/wilayah. Diverifikasi: 34 unit test; `test:e2e` 32 skenario (admin desa hanya melihat desanya, import 100 anggota dari Excel); uji browser Playwright 17 skenario.
- 2026-10-19 — 1 — Kategori generus jadi kolom manual `Anggota.kategori` (enum CABERAWIT/PRAREMAJA/REMAJA/USIA_NIKAH, boleh kosong), bukan dihitung dari umur; Setting batas usia dihapus dari seed. Ikut di DTO, filter `?kategori=` (termasuk `BELUM`), kolom import "Kategori" (opsional, dropdown di template), payload `anggota.upserted`, dan web (pilihan kategori di form, badge di tabel, filter, pratinjau import). Diverifikasi: unit test, `test:e2e` 37 skenario, uji browser 20 skenario.
- 2026-10-19 — 2A — Permintaan pemilik: kategori jadi tabel `Kategori` (dikelola admin, 9 kategori awal) dan relasi banyak-ke-banyak `AnggotaKategori`; migrasi memindahkan isi kolom lama. Peran `AUDITOR` (lihat saja). `AuditLog` dicatat untuk perubahan anggota, wali, wilayah, kategori, dan pengguna, dengan wilayah untuk filter scope; `GET /audit` dan `GET /anggota/:id/riwayat`. Admin bertingkat: ADMIN mengelola pengguna di dalam wilayahnya. Web: halaman Kategori, detail anggota (profil, wali, riwayat pindah, riwayat perubahan), Pengguna, Riwayat; pilihan banyak kategori di form, tabel, filter, dan import (dipisah koma). Seed: contoh admin daerah, admin desa, auditor. Diverifikasi: 40 unit test core, `test:e2e` 51 skenario, uji browser 27 skenario.
- 2026-10-19 — 2B — acara-svc: verifikasi JWT core lewat JWKS, scope dari `GET /internal/users/:id/scope`, salinan anggota `AnggotaRef` (event `anggota.upserted` + resync saat start, membawa `updatedAt`). Acara bertingkat KELOMPOK/DESA/DAERAH/GABUNGAN; peserta = wilayah × kategori (kode, kosong = semua) × jenis kelamin, dengan preview jumlah. Sesi, rundown (urutan bisa digeser), pengisi (anggota atau nama bebas), PJ, foto kegiatan (WebP maks 1600 px + thumbnail 320 px). Web: daftar & kalender acara, form dengan preview peserta langsung, detail (sesi & rundown, peserta, PJ, foto), cetak rundown, acara yang diikuti di profil anggota. Diverifikasi: `test:e2e` acara 45 skenario, uji browser 23 skenario.

## Keputusan
<!-- keputusan baru yang tidak ada di HANDOVER, beserta alasannya -->
- Generator Prisma memakai `prisma-client` (bukan `prisma-client-js` yang deprecated di Prisma 7), output `src/generated/prisma`, format CJS, karena NestJS dikompilasi ke CommonJS.
- `/health` mengembalikan 503 `{code: "DB_DOWN"}` bila database mati, supaya healthcheck Docker/Traefik nanti bermakna.
- Test memakai Vitest di semua paket (lebih ringan dari Jest).
- `packages/shared` dan `packages/face` di-build ke `dist/` (CJS) agar bisa dipakai NestJS; Next.js memakai `transpilePackages`.
- Nama queue BullMQ per consumer: `core-events`, `acara-events`, `wabot-events` (`QUEUES` dan `EVENT_ROUTES` di events.ts).
- Prettier tidak memformat `*.md` dan `infra/` agar dokumen asli tidak berubah.
- Hak akses: SUPER_ADMIN semua; ADMIN mengubah data di scope-nya; PENGURUS hanya melihat (mengambil keputusan izin di fase 7). Membuat daerah hanya SUPER_ADMIN; desa butuh scope daerah; kelompok butuh scope desa.
- Scope dihitung per request dari tabel UserScope + pohon wilayah (`computeScope`, fungsi murni). Scope DESA/KELOMPOK tetap melihat nama induknya agar pilihan bertingkat utuh. Data di luar scope dibalas 404 (detail) atau 403 `OUT_OF_SCOPE` (membuat data).
- Kode anggota `<kodeDesa>-<urut 4 digit>` memakai tabel baru `KodeCounter` (increment atomik). Kode tidak berubah saat mutasi.
- Mutasi: anggota harus di scope asal; kelompok tujuan boleh di luar scope (pindah keluar). UI hanya menampilkan kelompok yang terlihat oleh user.
- Refresh token stateless (JWT `typ: refresh`), dikirim sebagai cookie httpOnly `refresh_token` (juga di body untuk klien non-browser). User nonaktif ditolak saat refresh. Belum ada pencabutan token per sesi.
- Kunci JWT: `JWT_PRIVATE_KEY` (PEM) atau file `keys/jwt-private.pem`; di dev dibuat otomatis, di produksi wajib.
- Web memanggil core lewat rewrite `/api/core/*` (satu origin, cookie aman). Access token hanya di memori (zustand); saat halaman dibuka ulang, web memanggil /auth/refresh.
- Payload `anggota.upserted` ditambah `namaKelompok`, `namaDesa`, `namaDaerah` agar `AnggotaRef` di acara-svc terisi tanpa memanggil core.
- Event dikirim setelah commit dengan `addBulk` dan batas waktu 3 dtk per queue. Bila Redis mati, request tetap berhasil dan event dikirim saat Redis kembali (offline queue ioredis); bila service mati sebelum itu, consumer resync via `GET /internal/anggota`.
- BullMQ 6 memerlukan `ioredis` sebagai dependensi langsung.
- Import: baris valid disimpan dalam satu transaksi, baris bermasalah dilewati dan dilaporkan (nomor baris Excel). No WA ortu → Wali (upsert per nomor) dengan hubungan WALI. Maks 5.000 baris / 5 MB.
- Kolom waktu core memakai `timestamptz` (`@db.Timestamptz(3)`), sesuai AGENTS.md.
- Kategori diisi manual per anggota dari hasil assessment (keputusan pemilik), tidak dihitung dari umur; satu anggota boleh banyak kategori (dipilih pemilik). Daftar kategori berlaku lintas wilayah dan hanya diubah SUPER_ADMIN atau admin daerah. `kode` kategori tetap walau nama diganti; payload `anggota.upserted.kategori` berisi daftar kode. Tanpa kategori = belum di-assessment.
- Fase 2 dipecah: tahap A (kategori, auditor, riwayat, admin bertingkat) dan tahap B (acara dengan tingkat kelompok/desa/daerah/gabungan + pilihan kategori, dashboard admin & auditor).
- Riwayat perubahan dicatat di core (`AuditLog`) dengan daerah/desa/kelompok. Auditor melihat entri yang wilayah paling spesifiknya ada di wilayahnya; entri tanpa wilayah (kategori) hanya untuk SUPER_ADMIN. Mutasi dicatat di wilayah asal dan tujuan.
- Admin bertingkat: ADMIN mengelola pengguna yang seluruh wilayahnya di dalam wilayah ADMIN itu (termasuk sesama admin di tingkat yang sama), dan hanya memberi wilayah di dalamnya.
- Komponen shadcn/ui ditulis manual (registry tidak bisa diakses dari lingkungan build); Select memakai `<select>` bawaan agar ringan di HP.
- Pesan validasi zod memakai locale Indonesia.
- Penyelenggara acara = wilayah terkecil yang mencakup semua wilayah peserta; hanya ADMIN di wilayah penyelenggara yang bisa mengubah. Acara terlihat bila penyelenggara atau salah satu wilayah peserta bersinggungan dengan wilayah user (auditor & pengurus hanya lihat).
- Acara gabungan lintas daerah belum didukung (ditolak `WILAYAH_INVALID`); gabungan boleh campur desa dan kelompok.
- Aturan peserta disimpan satu baris `PesertaRule` per wilayah dengan kategori & jenis kelamin yang sama; peserta dihitung saat dibaca dari `AnggotaRef` berstatus AKTIF (snapshot ke `PesertaSesi` saat sesi dibuka, fase 3).
- Item rundown dihapus permanen (bukan data inti); acara, sesi, dan foto memakai `deletedAt`.
- Foto dikecilkan di browser lalu dikonversi ulang di server dengan sharp; file di `UPLOAD_DIR/acara/<id>/`.

## Tertunda / masalah
- Skema wabot belum punya migrasi (fase 7). Model acara untuk fase 3–6 (operator, absensi, wajah, rekap) sudah ikut migrasi awal acara dan bisa berubah.
- Belum ada UI untuk wali (API sudah ada). Belum ada rate limit login.
- Riwayat kehadiran per anggota menunggu fase 3. Statistik acara di dashboard ditambahkan setelah PR dashboard digabung.
- shadcn/ui di-init manual (components.json, `cn()`, Button); komponen lain ditambah dengan `pnpm dlx shadcn@latest add <nama>` dari apps/web.
- Celah skema untuk fase 2–6: `Tamu` belum berelasi ke `Sesi`; `Absensi.faceDataId` belum punya foreign key ke `FaceData`.
