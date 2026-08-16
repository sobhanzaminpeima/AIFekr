#!/usr/bin/env bash
# Run this ON THE PRODUCTION VPS (not from your local machine), as the user
# that owns the app / runs pm2. Requires: git remote already configured,
# node/npm, pm2, and a working DATABASE_URL in the server's .env.
#
# Usage: ssh onto the server, cd into the app directory, then:
#   bash scripts/deploy.sh
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-ai-platform}"

echo "==> Pulling latest main"
git pull origin main

echo "==> Installing dependencies"
npm install

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Seeding/updating packages (adds VOICE_MONTHLY etc.)"
node prisma/seed-packages.js

echo "==> Regenerating Prisma client"
npx prisma generate

echo "==> Building"
npm run build

echo "==> Restarting pm2 process: $APP_NAME"
pm2 restart "$APP_NAME"

echo "==> Done. Tailing recent logs (Ctrl+C to exit):"
pm2 logs "$APP_NAME" --lines 50
