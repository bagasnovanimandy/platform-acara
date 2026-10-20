# Integrasi SiKU (fase 8)

SiKU (repo `bagasnovanimandy/siku`) tetap aplikasi terpisah dengan database, peran, izin,
dan 2FA sendiri. Integrasinya hanya login tunggal dan tautan menu.

## Alur

1. User login di Platform Acara (core, JWT RS256).
2. Bila user punya peran SiKU (`User.sikuRoles`) dan core punya `SIKU_URL`, `GET /auth/me`
   mengembalikan `sikuTersedia: true` dan web menampilkan tombol **Keuangan (SiKU)**.
3. Tombol membuka `/keuangan` di web, yang memanggil `POST /auth/sso/siku`. Core
   mengembalikan `SIKU_URL/sso#token=...`: JWT RS256 sekali pakai (`aud=SIKU_AUDIENCE`,
   `typ=sso`, `jti` acak, berlaku 60 detik, berisi email & `sikuRoles`). Token ini tidak bisa
   dipakai sebagai access token core (audience & `typ` berbeda).
4. Halaman `/sso` SiKU menukar token di `POST /auth/sso/core`: verifikasi lewat JWKS core,
   tolak `jti` terpakai, cocokkan user lewat email, lalu buat sesi SiKU biasa.
5. Dari halaman login SiKU, tombol "Masuk lewat Platform Acara" membuka `/keuangan`
   (belum login → `/login?next=/keuangan` dulu).

## Impor pengguna SiKU

`POST /internal/siku/users/import` (header `x-internal-key`), dipanggil
`scripts/sync-users-to-platform.ts` di SiKU. Body `{ dryRun, users: [{ email, nama,
sikuRoles, passwordHash?, aktif }] }`.

- Email sudah ada di core → `sikuRoles` diganti sesuai SiKU; role, wilayah, dan password
  core tidak disentuh. User nonaktif di SiKU → `sikuRoles` dikosongkan.
- Email baru, aktif, punya peran → user baru role **AUDITOR tanpa wilayah** (tidak melihat
  data acara) dengan hash bcrypt dari SiKU, jadi password sama. Saat login pertama hash
  diganti argon2. Tanpa hash → password acak, admin perlu mereset.
- Setiap perubahan dicatat di audit log (`IMPORT` / `UPDATE`, entitas `User`).

## Konfigurasi

| Tempat | Variabel | Isi |
| --- | --- | --- |
| core | `SIKU_URL` | alamat web SiKU; kosong = integrasi mati |
| core | `SIKU_AUDIENCE` | `siku` |
| SiKU backend | `CORE_SSO_ENABLED` | `true` untuk menerima login dari core (bawaan `false`) |
| SiKU backend | `CORE_JWKS_URL` | `https://<platform>/api/core/auth/.well-known/jwks.json` |
| SiKU backend | `CORE_ISSUER`, `CORE_SSO_AUDIENCE` | `core-svc`, `siku` |
| SiKU frontend | `NEXT_PUBLIC_PLATFORM_URL` | alamat web platform (tombol di halaman login SiKU) |

Langkah lengkap sisi SiKU: `docs/operations/platform-acara-sso.md` di repo SiKU.

## Rollback

1. SiKU: `CORE_SSO_ENABLED=false` lalu restart backend. Login email/password SiKU tidak
   pernah dimatikan, jadi pengguna langsung kembali login seperti biasa.
2. Core: kosongkan `SIKU_URL` lalu restart core; tombol Keuangan (SiKU) hilang dan
   `POST /auth/sso/siku` mengembalikan 404.
3. Data: kolom `User.sikuRoles` boleh dibiarkan (tidak dipakai bila `SIKU_URL` kosong).
   User yang dibuat oleh impor adalah AUDITOR tanpa wilayah; nonaktifkan lewat menu
   Pengguna bila tidak diperlukan (data tidak dihapus permanen).
