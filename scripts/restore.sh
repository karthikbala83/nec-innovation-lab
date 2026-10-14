#!/bin/sh
# ---------------------------------------------------------------
# Restore a backup made by scripts/backup.sh (Docker setup).
#   sh scripts/restore.sh backups/2026-11-02_0200.archive.gz
# DROPS the current collections first — take a fresh backup before you do this.
# ---------------------------------------------------------------
set -eu
FILE="${1:?usage: sh scripts/restore.sh backups/<file>.archive.gz}"
DB="${MONGO_DB_NAME:-nec_innovation_lab}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }

printf "Restore %s into database %s? This replaces current data. Type yes: " "$FILE" "$DB"
read -r answer
[ "$answer" = "yes" ] || { echo "Cancelled"; exit 1; }

docker compose exec -T mongo mongorestore --drop --gzip --archive="/backups/$(basename "$FILE")" --nsInclude="$DB.*"
echo "Restored $FILE"
