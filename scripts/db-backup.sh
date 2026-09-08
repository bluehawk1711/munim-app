#!/usr/bin/env bash
# Backup the Munim Postgres database to a local .sql file.
# Usage:  pnpm db:backup
# Output: packages/core/backups/munim-YYYY-MM-DD_HHMMSS.sql

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

BACKUP_DIR="$(pwd)/packages/core/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$BACKUP_DIR/munim-${TIMESTAMP}.sql"

echo "Backing up database…"
pg_dump "$DATABASE_URL" --no-owner --no-privileges --no-comments -f "$FILE"
echo "Backup saved → $FILE"
