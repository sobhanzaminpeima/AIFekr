#!/usr/bin/env bash
# Run this ON THE PRODUCTION VPS after the reviewed source bundle has been
# copied there. It deliberately does not run `git pull`: production is not a
# git checkout, and pretending otherwise led to incomplete deploys.
# Requires node/npm, pm2, and a working DATABASE_URL in the server's .env.
#
# Usage: ssh onto the server, cd into the app directory, then:
#   bash scripts/deploy.sh
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-ai-platform}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set (for example in .env.local)." >&2
  exit 1
fi
DATABASE_PATH="${DATABASE_URL#file:}"

echo "==> Backing up the production database"
BACKUP_DIR=".deploy-backup-$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [[ -n "$DATABASE_PATH" && -f "$DATABASE_PATH" ]]; then
  cp "$DATABASE_PATH" "$BACKUP_DIR/prod.db"
fi

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Seeding missing packages (existing admin pricing is preserved)"
node prisma/seed-packages.js

echo "==> Regenerating Prisma client"
npx prisma generate

echo "==> Building"
npm run build

echo "==> Restarting pm2 process: $APP_NAME"
pm2 restart "$APP_NAME"

echo "==> Done. Tailing recent logs (Ctrl+C to exit):"
pm2 logs "$APP_NAME" --lines 50
