#!/usr/bin/env bash
# Backup harian: pg_dumpall (gzip) + rsync folder uploads & wa-auth, rotasi 14 hari.
# Cron (root, jam 02.30):
#   30 2 * * * /opt/platform-acara/infra/backup.sh >> /var/log/platform-acara-backup.log 2>&1
# Variabel (bisa di infra/.env.prod): DATA_DIR (bawaan /data), BACKUP_DEST (disk/drive lain,
# bawaan $DATA_DIR/backup), BACKUP_KEEP_DAYS (bawaan 14).
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env.prod}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a

DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DEST="${BACKUP_DEST:-$DATA_DIR/backup}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE=(docker compose -f "$INFRA_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE")
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DEST/$STAMP"

mkdir -p "$TARGET"
echo "[$(date -Is)] backup ke $TARGET"

# 1. Database: semua database (core_db, acara_db, wabot_db) + role, dalam satu file.
"${COMPOSE[@]}" exec -T postgres pg_dumpall -U app --clean --if-exists | gzip -6 > "$TARGET/postgres.sql.gz.part"
gzip -t "$TARGET/postgres.sql.gz.part"
mv "$TARGET/postgres.sql.gz.part" "$TARGET/postgres.sql.gz"

# 2. File: salinan penuh pertama, berikutnya hard link ke backup sebelumnya untuk file yang sama.
PREV="$(find "$BACKUP_DEST" -mindepth 1 -maxdepth 1 -type d -name '2*' ! -name "$STAMP" | sort | tail -1)"
for d in uploads wa-auth; do
  [ -d "$DATA_DIR/$d" ] || continue
  LINK=()
  [ -n "$PREV" ] && [ -d "$PREV/$d" ] && LINK=(--link-dest="$PREV/$d")
  rsync -a --delete "${LINK[@]}" "$DATA_DIR/$d/" "$TARGET/$d/"
done

# 3. Kunci JWT core (tanpa ini semua sesi & token SSO SiKU harus dibuat ulang).
[ -f "$DATA_DIR/secrets/jwt-private.pem" ] && install -m 600 "$DATA_DIR/secrets/jwt-private.pem" "$TARGET/jwt-private.pem"

touch "$TARGET/SELESAI"
echo "[$(date -Is)] selesai: $(du -sh "$TARGET" | cut -f1)"

# 4. Rotasi: hapus backup lebih tua dari KEEP_DAYS hari (hanya folder bertanda waktu).
find "$BACKUP_DEST" -mindepth 1 -maxdepth 1 -type d -name '2*' -mtime +"$KEEP_DAYS" -print -exec rm -rf {} +
