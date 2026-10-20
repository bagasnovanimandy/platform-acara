# Deploy ke home lab

Target: satu server (Ryzen 3 3200G, RAM 8 GB, SSD 128 GB) dengan Docker. Semua service
jalan dari `infra/docker-compose.prod.yml`; akses dari internet hanya lewat Cloudflare
Tunnel → Traefik. Tidak ada port yang dibuka ke router.

```
internet ─ Cloudflare (HTTPS) ─ cloudflared ─ traefik:80 ─┬─ /api/core/*  → core:3001
                                                         ├─ /api/acara/* → acara:3002
                                                         ├─ /api/wabot/* → wabot:3003
                                                         └─ /*           → web:3000
postgres (core_db, acara_db, wabot_db) · redis
```

`/api/*/internal/*` ditolak Traefik (403); endpoint antar-service hanya bisa dipakai dari
jaringan Docker `platform-acara_internal`.

| Container | Batas memori | Data |
| --- | --- | --- |
| postgres | 1 GB | volume `pgdata` |
| redis | 160 MB | volume `redisdata` (AOF) |
| core | 256 MB | `$DATA_DIR/secrets/jwt-private.pem` (baca saja) |
| acara | 320 MB | `$DATA_DIR/uploads` |
| wabot | 256 MB | `$DATA_DIR/wa-auth` |
| web | 384 MB | – |
| traefik, cloudflared | 64 MB | – |

Total ±2,5 GB, menyisakan ruang untuk SiKU (±500 MB) dan sistem.

## 1. Persiapan server (sekali)

```bash
# Docker Engine + plugin compose, rsync untuk backup
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y rsync git

sudo git clone https://github.com/bagasnovanimandy/platform-acara.git /opt/platform-acara
cd /opt/platform-acara

# Folder data. uid 1000 = user `node` di dalam container.
sudo mkdir -p /data/uploads /data/wa-auth /data/secrets /data/backup
sudo chown -R 1000:1000 /data/uploads /data/wa-auth

# Kunci privat JWT core (RS256). Simpan juga salinannya di tempat aman.
sudo openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /data/secrets/jwt-private.pem
sudo chmod 644 /data/secrets/jwt-private.pem

cp infra/.env.prod.example infra/.env.prod
chmod 600 infra/.env.prod
# isi POSTGRES_PASSWORD, INTERNAL_KEY, OPERATOR_JWT_SECRET (openssl rand -base64 32), token tunnel
```

## 2. Cloudflare Tunnel

1. Cloudflare Zero Trust → Networks → Tunnels → Create tunnel (Cloudflared) → salin token ke
   `CLOUDFLARE_TUNNEL_TOKEN`.
2. Public hostname: mis. `acara.contoh.org` → Service `HTTP` → `traefik:80`.
3. HTTPS ditangani Cloudflare; kamera di browser (absensi wajah) butuh HTTPS, jadi selalu buka
   lewat hostname ini, bukan IP lokal.

## 3. Build & jalankan

```bash
cd /opt/platform-acara
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod ps
```

Urutan otomatis: postgres & redis sehat → `*-migrate` menjalankan `prisma migrate deploy`
untuk tiap database → core → acara & wabot → web → traefik → cloudflared. Semua service punya
healthcheck (`/health` untuk API, `/login` untuk web).

Akun SUPER_ADMIN pertama (seed dev tidak dipakai di produksi):

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod run --rm \
  -e ADMIN_EMAIL=admin@contoh.org -e ADMIN_NAMA="Nama Admin" -e ADMIN_PASSWORD='password-panjang' \
  core node scripts/buat-super-admin.mjs
```

Bot WhatsApp: pakai **nomor khusus**. Login sebagai super admin → menu WhatsApp → tautkan dan
pindai QR. Auth state tersimpan di `/data/wa-auth`, jadi restart tidak perlu memindai ulang.
Jangan kirim pesan massal (risiko blokir).

## 4. Update versi

```bash
cd /opt/platform-acara
infra/backup.sh                     # backup dulu
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
docker image prune -f
```

Migrasi database berjalan otomatis sebelum service baru menyala. Bila ada masalah, kembali
ke commit sebelumnya (`git checkout <commit>`), build ulang, dan bila migrasi sudah mengubah
data, pulihkan dari backup (langkah 6).

## 5. Backup harian

`infra/backup.sh` membuat folder `$BACKUP_DEST/<tanggal-jam>/` berisi:
`postgres.sql.gz` (pg_dumpall semua database), `uploads/`, `wa-auth/` (rsync, file yang sama
di-hard-link ke backup sebelumnya sehingga hemat ruang), `jwt-private.pem`, dan penanda
`SELESAI`. Backup lebih tua dari 14 hari dihapus.

Arahkan `BACKUP_DEST` (di `infra/.env.prod`) ke disk/drive lain, bukan SSD sistem:

```bash
echo 'BACKUP_DEST=/mnt/backup/platform-acara' | sudo tee -a /opt/platform-acara/infra/.env.prod
sudo crontab -e
# 30 2 * * * /opt/platform-acara/infra/backup.sh >> /var/log/platform-acara-backup.log 2>&1
```

## 6. Restore & uji restore bulanan

```bash
ls /mnt/backup/platform-acara/          # pilih folder bertanda SELESAI
sudo /opt/platform-acara/infra/restore.sh /mnt/backup/platform-acara/20261020-023000
```

Skrip menghentikan service aplikasi, memuat ulang semua database dari dump, mengembalikan
`uploads` dan `wa-auth`, lalu menyalakan semuanya lagi. Data saat ini ditimpa.

Uji restore bulanan (di server cadangan atau laptop dengan Docker, bukan server produksi):

1. Clone repo, buat `infra/.env.prod` dengan `DATA_DIR` folder uji dan password apa saja,
   salin `jwt-private.pem` dari backup ke `$DATA_DIR/secrets/`.
2. `docker compose ... up -d postgres redis`, lalu `YES=1 infra/restore.sh <folder backup>`.
3. Cek: login web berhasil, jumlah anggota, acara, absensi, dan izin sama dengan produksi,
   foto kegiatan dan thumbnail wajah tampil.
4. Catat tanggal & hasil uji di log operasional.

Diuji saat fase 9: backup → hapus absensi, izin, audit log, dan 10 file upload → restore →
semua data dan file kembali (450 anggota, 111 absensi, 3 izin, 36 file), login berhasil.

## 7. SiKU di server yang sama

SiKU punya compose sendiri. Tambahkan public hostname kedua di tunnel yang sama
(mis. `siku.contoh.org` → alamat Caddy SiKU) lalu ikuti `docs/SIKU.md`:

- Platform: `SIKU_URL=https://siku.contoh.org` di `infra/.env.prod`, lalu
  `up -d core`.
- SiKU: `CORE_JWKS_URL=https://acara.contoh.org/api/core/auth/.well-known/jwks.json`.
- Sinkron pengguna SiKU butuh endpoint internal core, jadi jalankan skripnya dari jaringan
  internal platform:
  ```bash
  docker network connect platform-acara_internal <container-backend-siku>
  # PLATFORM_CORE_URL=http://core:3001, PLATFORM_INTERNAL_KEY=<INTERNAL_KEY>
  docker network disconnect platform-acara_internal <container-backend-siku>
  ```

## Perintah berguna

```bash
C="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod"
$C logs -f --tail=100 acara         # log satu service
$C restart wabot                    # restart satu service
$C exec postgres psql -U app core_db
docker stats --no-stream            # pemakaian memori per container
```
