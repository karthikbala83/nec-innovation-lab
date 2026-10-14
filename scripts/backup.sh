#!/bin/sh
# ---------------------------------------------------------------
# Back up the portal database (Docker setup) to ./backups/<date>.archive.gz
# and keep the newest 14. Run daily from cron on the college server:
#   0 2 * * *  cd /opt/nec-innovation-lab && sh scripts/backup.sh >> backups/backup.log 2>&1
# Restore: see docs/RUNBOOK.md ("Restore a backup").
# For Atlas (UAT / free tier) use Atlas backups or `mongodump --uri "$MONGO_URI"`.
# ---------------------------------------------------------------
set -eu
DB="${MONGO_DB_NAME:-nec_innovation_lab}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p backups

docker compose exec -T mongo mongodump --db "$DB" --archive="/backups/$STAMP.archive.gz" --gzip
echo "$(date) backup ok: backups/$STAMP.archive.gz"

# keep the newest 14 archives
ls -1t backups/*.archive.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
