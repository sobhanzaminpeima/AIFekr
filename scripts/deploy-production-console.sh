#!/usr/bin/env bash
set -Eeuo pipefail

# Console-safe production deployment for the current AIFekr FIT release.
# It intentionally uses the existing production environment and shared SQLite DB.

TARGET_COMMIT="c53b792"
TARGET_SHORT="c53b792"
REPO_URL="https://github.com/sobhanzaminpeima/AIFekr.git"
DB="/var/www/ai-platform/prisma/prisma/prod.db"
NEW="/var/www/aifekr-release-${TARGET_SHORT}"
BACKUPS="/var/www/aifekr-maintenance/backups"
PRIVATE_UPLOADS="/var/www/ai-platform/private-uploads/fitness"
PREVIEW_NAME="aifekr-fit-release-preview"
PREVIEW_PORT="3046"
DIST_DIR=".next-production-${TARGET_SHORT}"

exec 9>/var/lock/aifekr-production-deploy.lock
flock -n 9 || { echo "Another AIFekr deployment is already running." >&2; exit 1; }

for command in git node npm pm2 curl python3; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
test -s "$DB" || { echo "Production database not found: $DB" >&2; exit 1; }

OLD="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="ai-platform");if(!p)process.exit(2);process.stdout.write(p.pm2_env.pm_cwd||"")})')"
OLD_DIST="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="ai-platform");if(!p)process.exit(2);process.stdout.write((p.pm2_env.env&&p.pm2_env.env.NEXT_DIST_DIR)||p.pm2_env.NEXT_DIST_DIR||".next")})')"
test -d "$OLD" || { echo "Current PM2 release directory is invalid: $OLD" >&2; exit 1; }
test -f "$OLD/.env.local" || { echo "Current production .env.local is missing." >&2; exit 1; }

echo "Current release: $OLD"
echo "Target release:  $NEW"

pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true
if test -e "$NEW"; then
  echo "Target release already exists. Refusing to overwrite it: $NEW" >&2
  exit 1
fi

git clone --filter=blob:none --no-checkout "$REPO_URL" "$NEW"
git -C "$NEW" checkout --detach "$TARGET_COMMIT"
test "$(git -C "$NEW" rev-parse --short=7 HEAD)" = "$TARGET_SHORT"

cp -p "$OLD/.env.local" "$NEW/.env.local"
cp -an "$OLD/public/." "$NEW/public/"
mkdir -p "$PRIVATE_UPLOADS" "$BACKUPS"
if test -d "$OLD/private-uploads/fitness"; then
  cp -an "$OLD/private-uploads/fitness/." "$PRIVATE_UPLOADS/"
fi
if ! grep -q '^FIT_PRIVATE_UPLOAD_DIR=' "$NEW/.env.local"; then
  printf '\nFIT_PRIVATE_UPLOAD_DIR=%s\n' "$PRIVATE_UPLOADS" >> "$NEW/.env.local"
fi

# The established production releases share the audited dependency tree.
ln -s /var/www/aifekr-release-a8d7d61/node_modules "$NEW/node_modules"

cd "$NEW"
DATABASE_URL="file:${DB}" node node_modules/prisma/build/index.js generate
NODE_OPTIONS="--max-old-space-size=1536" NEXT_DIST_DIR="$DIST_DIR" npm run build

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DATABASE_URL="file:${DB}" node "$OLD/scripts/backup-deployment-db.cjs" "$BACKUPS/pre-fit-${TARGET_SHORT}-${STAMP}.db"

DATABASE_URL_PATH="$DB" RELEASE_PATH="$NEW" BASELINE_PATH="$BACKUPS/pre-fit-${TARGET_SHORT}-${STAMP}.json" python3 - <<'PY'
import json, os, pathlib, sqlite3

db = os.environ["DATABASE_URL_PATH"]
release = pathlib.Path(os.environ["RELEASE_PATH"])
connection = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
applied = {
    row[0]
    for row in connection.execute(
        "select migration_name from _prisma_migrations "
        "where finished_at is not null and rolled_back_at is null"
    )
}
pending = sorted(
    path.name
    for path in (release / "prisma" / "migrations").iterdir()
    if path.is_dir() and path.name not in applied
)
expected = [
    "20261011140000_fit_dynamic_billing",
    "20261012024500_business_credit_allocation",
    "20261012150000_fit_marketplace",
    "20261012180000_advanced_fit_programs",
    "20261012200000_fit_access_pricing",
]
if pending != expected:
    raise SystemExit(f"Unexpected pending migrations: {pending}")
active_jobs = connection.execute(
    "select count(*) from AiCourseGenerationJob "
    "where status in ('QUEUED','GENERATING_BLUEPRINT','GENERATING_CONTENT','VALIDATING')"
).fetchone()[0]
if active_jobs:
    raise SystemExit(f"Active course generation jobs must finish first: {active_jobs}")
baseline = {
    "users": connection.execute("select count(*) from User").fetchone()[0],
    "userCredits": connection.execute("select coalesce(sum(credits),0) from User").fetchone()[0],
    "teamCredits": connection.execute("select coalesce(sum(credits),0) from Team").fetchone()[0],
    "payments": connection.execute("select count(*) from Payment").fetchone()[0],
    "foreignKeyErrors": connection.execute("pragma foreign_key_check").fetchall(),
}
if baseline["foreignKeyErrors"]:
    raise SystemExit("Existing database has foreign-key errors; deployment stopped.")
pathlib.Path(os.environ["BASELINE_PATH"]).write_text(json.dumps(baseline), encoding="utf-8")
print(json.dumps({"pending": pending, **{k:v for k,v in baseline.items() if k != "foreignKeyErrors"}}))
PY

DATABASE_URL="file:${DB}" node node_modules/prisma/build/index.js migrate deploy

NEXT_DIST_DIR="$DIST_DIR" PORT="$PREVIEW_PORT" pm2 start /usr/bin/npm \
  --name "$PREVIEW_NAME" --cwd "$NEW" -- start -- -p "$PREVIEW_PORT" -H 127.0.0.1

ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/health" | grep -q '"status":"ok"'; then
    ready=1
    break
  fi
  sleep 2
done
if test "$ready" != 1; then
  pm2 logs "$PREVIEW_NAME" --lines 80 --nostream || true
  pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true
  echo "Preview health check failed; production was not switched." >&2
  exit 1
fi

DATABASE_URL_PATH="$DB" BASELINE_PATH="$BACKUPS/pre-fit-${TARGET_SHORT}-${STAMP}.json" python3 - <<'PY'
import json, os, sqlite3

baseline = json.load(open(os.environ["BASELINE_PATH"], encoding="utf-8"))
connection = sqlite3.connect(f"file:{os.environ['DATABASE_URL_PATH']}?mode=ro", uri=True)
current = {
    "users": connection.execute("select count(*) from User").fetchone()[0],
    "userCredits": connection.execute("select coalesce(sum(credits),0) from User").fetchone()[0],
    "teamCredits": connection.execute("select coalesce(sum(credits),0) from Team").fetchone()[0],
    "payments": connection.execute("select count(*) from Payment").fetchone()[0],
}
expected = {k: baseline[k] for k in current}
if current != expected:
    raise SystemExit(f"Production invariants changed unexpectedly: before={expected}, after={current}")
if connection.execute("pragma foreign_key_check").fetchall():
    raise SystemExit("Foreign-key check failed after migrations.")
print(json.dumps(current))
PY

rollback() {
  echo "Activation failed; restoring previous PM2 release: $OLD" >&2
  pm2 delete ai-platform >/dev/null 2>&1 || true
  NEXT_DIST_DIR="$OLD_DIST" PORT=3000 pm2 start /usr/bin/npm \
    --name ai-platform --cwd "$OLD" -- start -- -p 3000
  pm2 save >/dev/null
}
trap rollback ERR

pm2 delete ai-platform >/dev/null
NEXT_DIST_DIR="$DIST_DIR" PORT=3000 pm2 start /usr/bin/npm \
  --name ai-platform --cwd "$NEW" -- start -- -p 3000

production_ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3000/api/health" | grep -q '"status":"ok"'; then
    production_ready=1
    break
  fi
  sleep 2
done
test "$production_ready" = 1
pm2 save >/dev/null
pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true
trap - ERR

echo "DEPLOYMENT_OK commit=${TARGET_COMMIT} release=${NEW} backup=${BACKUPS}/pre-fit-${TARGET_SHORT}-${STAMP}.db"
