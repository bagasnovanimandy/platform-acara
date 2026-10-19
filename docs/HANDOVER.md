# HANDOVER — Platform Acara & Absensi Ngaji

> Dokumen ini adalah sumber kebenaran (single source of truth) untuk memulai project.
> Nama kerja: **platform-acara** (silakan ganti). Bahasa UI: Indonesia.

---

## 1. Ringkasan

Platform untuk mengelola acara pengajian di lingkup Daerah → Desa → Kelompok:

- Jadwal acara, sesi, rundown, pengisi tiap rundown, penanggung jawab, foto kegiatan.
- Absensi **face recognition offline** (HP di tripod / webcam laptop), lewat browser (PWA).
- Operator absensi **sementara** per sesi (per pintu), dibuat massal oleh admin, login via QR/PIN.
- Monitoring operator realtime (online/idle/offline, siapa input apa).
- Pendaftaran wajah **di tempat** dengan panduan menoleh (guided enrollment), diverifikasi admin belakangan tanpa mengganggu operator.
- Izin via **bot WhatsApp** bermenu: pilih acara → kategori → alasan → draft → konfirmasi → diteruskan ke pengurus → disetujui/ditolak.
- Rekap kehadiran: **HADIR / IZIN / SAKIT / ALPHA**.
- **SiKU** (keuangan, sudah live) nantinya bergabung sebagai service keuangan dengan login tunggal (SSO).

### Prinsip
1. **Sederhana dulu.** 3 service baru + SiKU. Jangan pecah lebih jauh sebelum ada kebutuhan nyata (server home lab RAM 8 GB).
2. **Offline-first** untuk perangkat operator. Server tidak boleh jadi titik gagal saat absen.
3. **Operator tidak pernah menunggu admin.** Semua verifikasi bersifat asinkron.
4. **Data tidak dihapus**, hanya dinonaktifkan (riwayat absensi tetap utuh).
5. **Privasi:** banyak anggota di bawah umur. Data pribadi hanya untuk admin.

---

## 2. Arsitektur

```
                  Cloudflare Tunnel
                         │
                     Traefik (gateway)
     ┌──────────────┬────┴─────────┬───────────────┬─────────────┐
     │              │              │               │             │
  apps/web      core-svc       acara-svc       wabot-svc     siku (existing)
  Next.js 15    NestJS         NestJS          NestJS+Baileys  NestJS
  admin+PWA     auth, anggota, acara, sesi,    menu bot, izin,
  operator      wilayah, wali  rundown, foto,  routing pengurus
                               absensi, wajah,
                               operator, rekap
     │              │              │               │
     └──────── PostgreSQL (1 instance, 1 database per service) ───┘
                         Redis (BullMQ events + sesi bot + cache)
                         Storage foto: folder volume lokal (/data/uploads)
```

### Service

| Service | Tanggung jawab | DB |
|---|---|---|
| `core-svc` | Login & JWT (SSO), user & role, wilayah (Daerah/Desa/Kelompok), anggota, wali, mutasi sambung | `core_db` |
| `acara-svc` | Acara, sesi, rundown, pengisi, PJ, foto, peserta target, operator sementara, absensi, data wajah, rekap | `acara_db` |
| `wabot-svc` | Koneksi WA (Baileys), state machine menu, pengajuan izin, notifikasi ke pengurus/admin | `wabot_db` |
| `siku` | Keuangan (sudah ada). Fase akhir: login lewat core-svc | `siku_db` |
| `apps/web` | Satu Next.js: dashboard admin (`/admin`), PWA operator (`/op`), halaman pengurus (`/pengurus`) | – |

### Aturan antar-service
- Service **tidak** mengakses database service lain. Referensi lintas service hanya berupa ID (`anggotaId`, `userId`).
- Komunikasi sinkron: HTTP internal (`http://core-svc:3000/internal/...`) dengan header `x-internal-key`.
- Komunikasi asinkron: **BullMQ** di Redis. Producer mengirim ke queue milik consumer.
- `acara-svc` menyimpan **salinan ringkas anggota** (read model) yang diperbarui lewat event dari core, supaya paket offline & rekap tidak bergantung pada core saat runtime.

### Event (BullMQ)

| Event | Producer | Consumer | Payload |
|---|---|---|---|
| `anggota.upserted` | core | acara, wabot | `{id, kode, nama, jk, tglLahir, kelompokId, desaId, daerahId, status, noWa, waliNoWa[]}` |
| `anggota.mutasi` | core | acara | `{anggotaId, dariKelompokId, keKelompokId, tanggal}` |
| `izin.submitted` | wabot | acara | `{izinId, anggotaId, sesiId?, acaraId, kategori, alasan}` |
| `izin.decided` | wabot | acara | `{izinId, status, decidedBy, decidedAt}` |
| `face.enrolled` | acara | wabot | `{faceDataId, anggotaId, operatorLabel}` → notifikasi WA admin (opsional) |
| `sesi.closed` | acara | wabot | `{sesiId}` → kirim rekap ringkas ke PJ (opsional) |

### Auth
- `core-svc` menerbitkan **JWT RS256**. Service lain memverifikasi via JWKS (`/auth/.well-known/jwks.json`).
- Role: `SUPER_ADMIN`, `ADMIN`, `PENGURUS`, `OPERATOR`.
- `ADMIN`/`PENGURUS` punya **scope wilayah** (daerah/desa/kelompok) → hanya melihat data di wilayahnya.
- `OPERATOR` **tidak** dibuat di core. Token operator diterbitkan oleh `acara-svc` (JWT berumur sampai sesi berakhir, claims: `operatorSessionId`, `sesiId`, `acaraId`, `label`). Verifikasi tetap via kunci milik acara-svc.

---

## 3. Stack

| Bagian | Pilihan |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | NestJS 10/11, Prisma, PostgreSQL 16, Zod (validasi DTO via `nestjs-zod`) |
| Frontend | Next.js 15 (App Router), shadcn/ui, TanStack Query, Zustand |
| Offline | Service Worker (Serwist), IndexedDB (Dexie) |
| Face | `@vladmandic/face-api` — TinyFaceDetector + FaceLandmark68Tiny + FaceRecognition |
| Realtime | SSE dari acara-svc (cukup, tidak perlu WebSocket) |
| WA | `@whiskeysockets/baileys` (nomor khusus bot) |
| Queue | BullMQ + Redis 7 |
| Gateway | Traefik |
| Deploy | Docker Compose di home lab + Cloudflare Tunnel |

Struktur folder:
```
platform-acara/
├─ apps/web/
├─ services/core/        (prisma/schema.prisma)
├─ services/acara/       (prisma/schema.prisma)
├─ services/wabot/       (prisma/schema.prisma)
├─ packages/shared/      (tipe, zod schema, nama event, util nomor WA)
├─ packages/face/        (wrapper face-api: load model, deteksi, embedding, pose, matcher)
├─ infra/                (docker-compose, traefik, cloudflared, backup)
├─ docs/
└─ AGENTS.md
```

---

## 4. Model Data (ringkas)

Draft lengkap ada di `services/*/prisma/schema.prisma`.

### core_db
- **Daerah** → **Desa** → **Kelompok** (bertingkat, bukan teks bebas).
- **Anggota**: `kode` (mis. `JS-0001`), `nama`, `jenisKelamin`, `tanggalLahir`, `noWa?` (format `62…`), `kelompokId`, `status` (AKTIF/PINDAH/NONAKTIF), `fotoUrl?`.
  - **Alamat sambung = Kelompok–Desa–Daerah**, diturunkan dari `kelompokId`. Tidak ada field alamat sambung terpisah, tidak ada alamat rumah.
  - Kategori usia (caberawit/praremaja/remaja/usia nikah) **dihitung** dari tanggal lahir, tidak disimpan. Batas usia dikonfigurasi di tabel `Setting`.
- **Wali** (`noWa` unik) ↔ **AnggotaWali** (satu wali bisa punya banyak anak).
- **MutasiSambung**: riwayat pindah kelompok.
- **User** (admin/pengurus) + **UserScope** (wilayah).

### acara_db
- **AnggotaRef**: salinan ringkas anggota dari core.
- **Acara** → **Sesi** → **RundownItem** (+ **Pengisi** per item).
- **AcaraPJ**: penanggung jawab acara (peran: PJ_UMUM, PJ_IZIN, dll).
- **PesertaRule**: aturan peserta target (filter wilayah, jenis kelamin, kategori usia). Hasilnya di-*snapshot* ke **PesertaSesi** saat sesi dibuka, supaya rekap tidak berubah walau data anggota berubah.
- **FotoKegiatan**.
- **OperatorSession**: operator sementara per sesi (label pintu, PIN hash, token, `expiresAt`, `revokedAt`, `lastSeenAt`, `lastScanAt`, info perangkat).
- **Absensi**: unik `(sesiId, anggotaId)`; `metode` (WAJAH/MANUAL/TAMU), `operatorSessionId`, `capturedAt` (waktu di perangkat), `syncedAt`, `clientId` (UUID dari perangkat, idempoten), `faceDistance?`.
- **AbsensiDuplikat**: log scan ganda dari pintu lain.
- **Tamu**: orang yang belum terdaftar (nama saja), dirapikan admin nanti.
- **FaceData**: `anggotaId`, `embeddings` (5 × 128 float), `thumbnails` (5 path), `status` (PENDING/VERIFIED/REJECTED), `enrolledByOperatorSessionId?`, `verifiedBy?`.
- **IzinRef**: salinan izin yang disetujui (dari wabot) untuk rekap.
- **Rekap**: status final per `(sesiId, anggotaId)` — HADIR/IZIN/SAKIT/ALPHA, dihitung saat sesi ditutup (bisa dihitung ulang).

### wabot_db
- **WaSession**: kredensial Baileys (auth state) — atau simpan di volume file.
- **Izin**: `anggotaId`, `pengajuNoWa`, `pengajuTipe` (ANGGOTA/WALI), `acaraId`, `sesiId?`, `kategori` (IZIN/SAKIT), `alasan`, `status` (DRAFT/SUBMITTED/APPROVED/REJECTED/CANCELLED), `handlerUserId`, `decidedAt`, `catatanPengurus?`.
- **PesanLog**: log pesan masuk/keluar (untuk audit & debug).
- State percakapan bot disimpan di **Redis** (`bot:state:{noWa}`, TTL 10 menit), bukan di DB.

---

## 5. Alur Fitur

### 5.1 Acara & rundown (admin)
1. Buat Acara (nama, jenis, wilayah penyelenggara, tanggal mulai–selesai, lokasi).
2. Tambah Sesi (mis. "Sesi Pagi", jam mulai–selesai, toleransi terlambat).
3. Tambah Rundown per sesi (urutan, jam, judul, pengisi: anggota terdaftar atau nama bebas).
4. Tetapkan PJ acara dan **PJ_IZIN** (penerima izin). Bila kosong → fallback ke pengurus kelompok anggota.
5. Atur peserta target (PesertaRule).
6. Upload foto kegiatan (dikompres di browser ke maks 1600px, WebP).

### 5.2 Operator sementara
1. Di halaman sesi, admin isi **jumlah pintu** → klik Generate.
2. Sistem membuat N `OperatorSession` dengan label "Pintu 1..N", PIN 6 digit, dan QR (berisi URL `/op/login?t=<token-sekali-pakai>`).
3. Admin cetak kartu QR atau kirim via WA.
4. Penjaga scan QR / buka `/op` dan isi PIN → mendapat JWT operator sampai `sesi.selesai + 2 jam`.
5. Admin bisa **cabut** / **reset PIN** per operator kapan saja.

### 5.3 Paket offline & absen
1. Setelah login, perangkat mengunduh `GET /op/paket` → daftar peserta sesi + embedding wajah (VERIFIED + PENDING) + model face-api (di-cache Service Worker).
2. Loop deteksi tiap **400 ms**, video 640×480, TinyFaceDetector `inputSize: 320`, `scoreThreshold: 0.5`.
3. Cocokkan dengan `FaceMatcher`, threshold jarak **0.5** (konfigurasi per acara).
4. Cocok → tampil nama + centang hijau 1,5 detik → simpan ke IndexedDB → antrean sinkron.
5. Cooldown per anggota 60 detik (tidak tercatat dobel di pintu yang sama).
6. Sinkron: `POST /op/absensi/batch` tiap 5 detik bila online. Idempoten via `clientId`. Server menyimpan **capturedAt paling awal**; scan lain masuk `AbsensiDuplikat`.
7. Pilih kamera: dropdown dari `enumerateDevices()`; ingat pilihan di localStorage.

### 5.4 Wajah tidak dikenali (tidak boleh macet)
- Tombol **Cari Nama** selalu tampil. Bila wajah terdeteksi tapi tidak cocok selama 3 detik → tampil saran "Cari nama?".
- Cari (nama/kode, fuzzy, offline dari paket) → **Hadir** (metode MANUAL).
- Setelah itu tampil **"Daftarkan wajah sekarang?"** → guided enrollment (5.5). Bisa dilewati.
- Tombol **Tamu** → isi nama saja.

### 5.5 Guided enrollment (menoleh)
Urutan pose: **Lurus → Kiri → Kanan → Atas → Bawah**. Foto diambil otomatis saat pose sesuai, ditahan stabil ±300 ms.

Estimasi pose dari 68 landmark:
```
mataKiri  = rata-rata titik 36..41
mataKanan = rata-rata titik 42..47
tengahMata = (mataKiri + mataKanan) / 2
jarakMata = |mataKanan.x - mataKiri.x|
hidung = titik 30, dagu = titik 8

yaw   = (hidung.x - tengahMata.x) / jarakMata
pitch = (hidung.y - tengahMata.y) / (dagu.y - tengahMata.y)   // ±0.4–0.5 saat lurus; kalibrasi saat pose "Lurus"

Lurus : |yaw| < 0.08
Kiri  : yaw < -0.22   (arah dicek terhadap mirror kamera depan)
Kanan : yaw >  0.22
Atas  : pitch < pitchLurus - 0.08
Bawah : pitch > pitchLurus + 0.08
```
Cek kualitas: skor deteksi ≥ 0.8, lebar wajah ≥ 25% frame, variansi Laplacian (blur) di atas ambang. Pesan: "Dekatkan wajah", "Kurang terang", "Tahan sebentar".

Selesai → simpan lokal (5 embedding + 5 thumbnail 160px WebP) → wajah **langsung dipakai** di perangkat itu → status `PENDING` → disinkron → admin dapat notifikasi.

### 5.6 Verifikasi wajah (admin)
- Badge realtime "N wajah perlu verifikasi" (SSE) + opsional WA ke admin.
- Halaman verifikasi: 5 thumbnail berdampingan dengan foto profil & wajah terverifikasi sebelumnya, nama operator, pintu, waktu.
- Aksi: **Setujui** → VERIFIED; **Tolak** → REJECTED, embedding tidak lagi dikirim di paket, absensi yang memakai wajah itu ditandai `perluTinjau`; **Ganti anggota** → pindahkan ke anggota yang benar.
- Absensi oleh wajah PENDING ditandai kuning di rekap sampai diverifikasi.

### 5.7 Monitoring operator
- Perangkat kirim heartbeat `POST /op/heartbeat` tiap 20 detik (`{online, sedangInput, antrean, baterai?}`).
- Status: **Online** (`lastSeenAt` < 45 dtk), **Idle** (online tapi `lastScanAt` > 5 menit), **Offline** (tampil "terakhir sinkron hh:mm").
- Dashboard per sesi (SSE): kartu per pintu → status, jumlah input, scan terakhir, antrean belum sinkron, perangkat. Klik → daftar absensi oleh operator itu.

### 5.8 Izin via WA bot
State machine (Redis):
```
START
 └─ pesan masuk → cocokkan noWa ke Anggota.noWa atau Wali.noWa
      ├─ tidak dikenal → balas "Nomor belum terdaftar, hubungi pengurus." (selesai)
      └─ dikenal → MENU
MENU:  1. Ajukan izin   2. Cek status izin   3. Jadwal acara terdekat
 1 → (jika Wali dgn >1 anak) PILIH_ANAK
   → PILIH_ACARA (acara/sesi 14 hari ke depan yang anggota termasuk pesertanya, bernomor)
   → PILIH_KATEGORI (1. Izin  2. Sakit)
   → ISI_ALASAN (teks bebas, maks 300 karakter)
   → DRAFT: tampilkan ringkasan →  1. Kirim  2. Ubah alasan  3. Batal
   → KIRIM: simpan SUBMITTED, teruskan ke PJ_IZIN, balas "Izin terkirim, menunggu persetujuan."
Ketik "menu" kapan saja → kembali ke MENU. "batal" → reset.
```
Pesan ke pengurus:
```
📋 Pengajuan izin #IZ-0123
Nama   : Ahmad (JS-0012) — Kel. X, Desa Y
Acara  : Pengajian Umum — Ahad, 25 Okt, Sesi Pagi
Kategori: Sakit
Alasan : demam sejak semalam
Balas: SETUJU 0123  atau  TOLAK 0123 <catatan>
```
- Pengurus juga bisa memutuskan dari halaman `/pengurus/izin`.
- Hasil keputusan dikirim balik ke pengaju.
- Izin APPROVED → event `izin.decided` → masuk rekap sebagai IZIN/SAKIT.
- Batas waktu pengajuan: sampai jam mulai sesi (konfigurasi). Lewat itu bot menolak.

### 5.9 Rekap
Saat sesi ditutup (manual atau cron `selesai + 2 jam`):
```
untuk setiap PesertaSesi:
  ada Absensi            → HADIR (tandai TERLAMBAT bila capturedAt > mulai + toleransi)
  izin APPROVED (SAKIT)  → SAKIT
  izin APPROVED (IZIN)   → IZIN
  lainnya                → ALPHA
```
- Bisa **hitung ulang** bila ada koreksi (absensi manual susulan oleh admin, izin telat diputuskan).
- Ekspor Excel/PDF per sesi, per acara, per kelompok/desa/daerah.

---

## 6. Kontrak API (garis besar)

Prefix lewat gateway: `/api/core`, `/api/acara`, `/api/wabot`.

**core-svc**
```
POST /auth/login                 GET /auth/me          GET /auth/.well-known/jwks.json
GET/POST/PATCH /wilayah/daerah|desa|kelompok
GET/POST/PATCH /anggota          POST /anggota/import (xlsx)
POST /anggota/:id/mutasi         GET/POST /wali
GET /internal/anggota?ids=…      (x-internal-key)
```
**acara-svc**
```
CRUD /acara  /acara/:id/sesi  /sesi/:id/rundown  /acara/:id/pj  /acara/:id/peserta-rule
POST /acara/:id/foto
POST /sesi/:id/operator/generate {jumlah}   GET /sesi/:id/operator   POST /operator/:id/revoke|reset-pin
GET  /sesi/:id/monitor (SSE)
POST /sesi/:id/tutup             GET /sesi/:id/rekap   GET /sesi/:id/rekap.xlsx
GET  /face/pending               POST /face/:id/verify|reject|reassign

-- operator (JWT operator) --
POST /op/login {token|pin, label}   GET /op/paket   POST /op/heartbeat
POST /op/absensi/batch              POST /op/face/enroll   POST /op/tamu
```
**wabot-svc**
```
GET  /wa/status   POST /wa/pair (QR pairing, admin)
GET  /izin?status=&acaraId=        POST /izin/:id/decide {status, catatan}
```

---

## 7. Roadmap & Kriteria Selesai

| Fase | Isi | Selesai bila |
|---|---|---|
| **0. Fondasi** | Monorepo, docker-compose dev (postgres, redis), lint, packages/shared, CI sederhana | `pnpm dev` menjalankan semua service + web; healthcheck hijau |
| **1. Core** | Auth JWT RS256, user & scope, wilayah, anggota, wali, import Excel, mutasi | Admin login, import 100 anggota dari Excel, filter per wilayah benar |
| **2. Acara** | Acara, sesi, rundown, pengisi, PJ, peserta rule, foto | Satu acara lengkap dengan rundown bisa dibuat & dicetak |
| **3. Absensi offline** | packages/face, PWA operator, paket offline, absen wajah + cari nama + tamu, sinkron batch | Absen 30 orang dengan **Wi-Fi dimatikan**, lalu sinkron tanpa duplikat |
| **4. Operator & monitoring** | Generate operator, QR/PIN, heartbeat, dashboard SSE | 3 perangkat login bersamaan, status online/idle/offline akurat |
| **5. Enrollment & verifikasi** | Guided enrollment 5 pose, notifikasi, halaman verifikasi | Daftar wajah < 10 detik; wajah baru langsung dikenali; admin bisa setujui/tolak |
| **6. Rekap** | Tutup sesi, hitung HADIR/IZIN/SAKIT/ALPHA, ekspor | Rekap cocok dengan data uji manual |
| **7. WA bot & izin** | Baileys, state machine, draft, routing PJ, keputusan via WA/web | Alur izin end-to-end via WA; hasil masuk rekap |
| **8. Integrasi SiKU** | SiKU login via core (SSO), migrasi user SiKU ke core | Satu akun bisa masuk SiKU & platform acara |
| **9. Deploy** | Compose produksi, Traefik, Cloudflare Tunnel, backup | Berjalan di home lab, backup harian teruji restore |

Kerjakan **berurutan**. Fase 3 boleh dimulai paralel dengan fase 2 karena packages/face berdiri sendiri.

---

## 8. Pengujian
- Unit test: logika rekap, normalisasi nomor WA, estimasi pose, state machine bot (pure function).
- E2E (Playwright): login admin, buat acara, generate operator, login operator via PIN.
- Uji lapangan fase 3–5: HP Android RAM 3–4 GB + laptop webcam internal + webcam USB; cahaya dalam ruangan; 30+ wajah.
- Ukur: waktu dari wajah masuk frame → tercatat (target < 1,5 detik), FPS deteksi, ukuran paket offline.

---

## 9. Deploy Home Lab (ringkas)
- Server: Ryzen 3 3200G, RAM 8 GB, SSD 128 GB.
- Anggaran RAM kira-kira: Postgres 1 GB, Redis 128 MB, tiap NestJS 150–250 MB, Next.js 300 MB, Traefik 50 MB, SiKU ±500 MB → total ±3 GB. Masih aman.
- Foto & thumbnail di volume `/data/uploads`; perhatikan kapasitas SSD (kompres, batasi resolusi).
- Cloudflare Tunnel → Traefik `:80`. Kamera di browser butuh HTTPS: sudah terpenuhi oleh Cloudflare.
- Backup: `pg_dumpall` harian + rsync `/data/uploads` ke disk/drive lain; uji restore bulanan.
- WA bot: pakai **nomor khusus**, simpan auth state di volume, jangan kirim pesan massal (risiko blokir).

---

## 10. Keputusan yang sudah diambil
- Face recognition berjalan **di browser** (face-api), tanpa anti-spoofing (cukup untuk absensi ngaji).
- Kamera apa saja: HP (tripod), webcam internal/eksternal.
- Operator sementara per sesi, login QR/PIN, tidak dibuat di core.
- Wajah hasil enrollment operator langsung dipakai, diverifikasi admin belakangan.
- Alamat sambung = Kelompok–Desa–Daerah (relasi), bukan alamat rumah.
- WA via Baileys, menu teks bernomor.

## 11. Pertanyaan terbuka
- Batas usia tiap kategori generus (diisi di Setting).
- Apakah satu acara bisa lintas desa/daerah dengan admin berbeda? (Asumsi awal: ya, via PesertaRule + scope penyelenggara.)
- Siapa default PJ_IZIN bila acara tidak menetapkan.
- Format kode anggota (asumsi: `<kode desa>-<nomor urut 4 digit>`).
