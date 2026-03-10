#!/bin/bash
# Crux — nightly database backup
# Backs up all gym DBs + platform DB to /home/ec2-user/crux-backups/
# Keeps last 14 days. Run via cron: 0 3 * * * /path/to/backup-dbs.sh

BACKUP_ROOT="/home/ec2-user/crux-backups"
DATA_ROOT="/home/ec2-user/.openclaw/workspace/boulderryn-project/data"
DATE=$(date +%Y-%m-%d)
DEST="$BACKUP_ROOT/$DATE"

mkdir -p "$DEST"

# Back up platform DB
if [ -f "$DATA_ROOT/platform.db" ]; then
  sqlite3 "$DATA_ROOT/platform.db" ".backup '$DEST/platform.db'"
  echo "[backup] platform.db → $DEST/platform.db"
fi

# Back up each gym DB
for GYM_DIR in "$DATA_ROOT/gyms"/*/; do
  GYM_ID=$(basename "$GYM_DIR")
  DB="$GYM_DIR/gym.db"
  if [ -f "$DB" ]; then
    mkdir -p "$DEST/gyms/$GYM_ID"
    sqlite3 "$DB" ".backup '$DEST/gyms/$GYM_ID/gym.db'"
    echo "[backup] $GYM_ID/gym.db → $DEST/gyms/$GYM_ID/gym.db"
  fi
done

# Delete backups older than 14 days
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null

echo "[backup] Done — $(date)"
