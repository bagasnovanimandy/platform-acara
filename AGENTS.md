# AGENTS.md — Aturan untuk agen coding (Codex / OpenCode / Claude Code)

Baca **docs/HANDOVER.md** sebelum mengerjakan apa pun. Dokumen itu sumber kebenaran.

## Cara kerja
- Kerjakan **satu fase** dari docs/HANDOVER.md §7 per tugas. Jangan melompat fase.
- Sebelum menulis kode, tulis rencana singkat (file yang dibuat/diubah) di awal jawaban.
- Setelah selesai: jalankan `pnpm lint`, `pnpm typecheck`, `pnpm test`. Semua harus lulus.
- Perbarui `docs/PROGRESS.md`: centang item, catat keputusan baru dan hal yang tertunda.
- Bila menemui keputusan yang tidak tercakup di HANDOVER, pilih opsi paling sederhana, catat di PROGRESS.md bagian "Keputusan", lanjutkan.

## Aturan arsitektur
- Service tidak boleh membaca database service lain. Lintas service hanya via HTTP internal atau event BullMQ.
- Nama event & payload didefinisikan **hanya** di `packages/shared/src/events.ts` (dengan zod schema).
- Setiap service punya Prisma schema sendiri di `services/<nama>/prisma/schema.prisma`.
- Prisma versi terbaru (7+): URL database **tidak** ditulis di schema, tapi di `services/<nama>/prisma.config.ts` (sudah disediakan). PrismaClient memakai driver adapter `@prisma/adapter-pg`. (Berbeda dengan SiKU yang memakai pola lama; jangan disamakan.)
- Jangan menambah service baru tanpa persetujuan.
- Data tidak dihapus permanen (pakai `status`/`deletedAt`), kecuali data wajah yang ditolak.

## Konvensi kode
- TypeScript strict. Tanpa `any` kecuali di batas library pihak ketiga.
- NestJS: satu module per domain (`acara`, `sesi`, `operator`, `absensi`, `face`, `rekap`, ...).
- Validasi input pakai zod (`nestjs-zod`). Response error konsisten: `{ code, message, details? }`.
- Nama tabel/kolom dalam bahasa Indonesia sesuai HANDOVER; kode umum (variabel teknis) boleh Inggris.
- Nomor WA selalu dinormalisasi ke `62…` lewat `normalizeWa()` di packages/shared.
- Waktu disimpan UTC (`timestamptz`), ditampilkan Asia/Jakarta.
- Semua endpoint admin dicek scope wilayah.

## Frontend
- Next.js 15 App Router, shadcn/ui, TanStack Query.
- `/admin/*` untuk admin & pengurus, `/op/*` untuk operator (PWA, offline-first), `/pengurus/*` untuk keputusan izin.
- PWA operator harus tetap berfungsi dengan jaringan mati setelah paket diunduh. Uji dengan DevTools → Offline.
- UI dalam Bahasa Indonesia, sederhana, tombol besar untuk layar operator.

## Face recognition
- Gunakan `packages/face` (wrapper `@vladmandic/face-api`). Jangan panggil face-api langsung dari komponen.
- Model hanya: tiny_face_detector, face_landmark_68_tiny, face_recognition. Host di `apps/web/public/models`.
- Parameter default: video 640×480, interval deteksi 400 ms, inputSize 320, threshold jarak 0.5.

## Keamanan
- Rahasia hanya di `.env` (jangan di-commit). Sediakan `.env.example`.
- PIN operator disimpan sebagai hash (argon2). Token QR sekali pakai, berlaku 24 jam.
- Data pribadi anggota (noWa, tanggal lahir, wali) tidak dikirim ke operator. Paket offline hanya berisi id, kode, nama, kelompok, embedding.

## Jangan
- Jangan mengubah repo SiKU kecuali di fase 8.
- Jangan menambah dependensi berat (TensorFlow Python, OpenCV native, Kafka, Kubernetes).
- Jangan mengirim pesan WA massal dari bot.
