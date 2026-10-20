#!/usr/bin/env bash
# Pulihkan dari satu folder backup (hasil infra/backup.sh).
#   infra/restore.sh /data/backup/20261020-023000
# Menghentikan service aplikasi, memuat ulang semua database, mengembalikan uploads & wa-auth,
# lalu menyalakan lagi. Data saat ini DITIMPA; jalankan backup.sh dulu bila ragu.
set -euo pipefail

SRC="${1:?pakai: restore.sh <folder backup>}"
[ -f "$SRC/SELESAI" ] || { echo "Backup $SRC tidak lengkap (tanpa penanda SELESAI)"; exit 1; }

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env.prod}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a
DATA_DIR="${DATA_DIR:-/data}"
COMPOSE=(docker compose -f "$INFRA_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE")

if [ "${YES:-}" != "1" ]; then
  read -r -p "Timpa database & file dengan $SRC? Ketik YA: " jawab
  [ "$jawab" = "YA" ] || { echo "Dibatalkan"; exit 1; }
fi

echo "[$(date -Is)] menghentikan service aplikasi"
"${COMPOSE[@]}" stop cloudflared traefik web wabot acara core

echo "[$(date -Is)] memuat database"
"${COMPOSE[@]}" up -d postgres
until "${COMPOSE[@]}" exec -T postgres pg_isready -U app >/dev/null 2>&1; do sleep 1; done
# Dump memakai --clean --if-exists: tiap database di-DROP lalu dibuat ulang.
gunzip -c "$SRC/postgres.sql.gz" | "${COMPOSE[@]}" exec -T postgres psql -U app -d postgres -v ON_ERROR_STOP=0 -q >/dev/null

echo "[$(date -Is)] mengembalikan file"
for d in uploads wa-auth; do
  [ -d "$SRC/$d" ] || continue
  mkdir -p "$DATA_DIR/$d"
  rsync -a --delete "$SRC/$d/" "$DATA_DIR/$d/"
done
if [ -f "$SRC/jwt-private.pem" ] && [ ! -f "$DATA_DIR/secrets/jwt-private.pem" ]; then
  install -D -m 644 "$SRC/jwt-private.pem" "$DATA_DIR/secrets/jwt-private.pem"
fi

echo "[$(date -Is)] menyalakan service"
"${COMPOSE[@]}" up -d
echo "[$(date -Is)] selesai; cek: ${COMPOSE[*]} ps"
