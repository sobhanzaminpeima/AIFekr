#!/usr/bin/env bash
set -Eeuo pipefail

# Reusable production release for AIFekr, generalised from
# deploy-production-console.sh (same release-directory + preview + switch +
# rollback pattern, same shared SQLite database).
#
#   bash deploy-release.sh check  <commit> [source]   # read-only report, changes nothing
#   bash deploy-release.sh deploy <commit> [source]   # build, migrate, verify, switch
#
# <source> is a git URL or a local git bundle (`git bundle create ...`), so a
# reviewed commit can be shipped without pushing it to GitHub first.
#
# Migration history repair (2026-10-24 audit): two migrations were renamed so
# they sort after the migration that creates their table, and five
# catch-up/reconcile migrations were added for schema changes that had only
# ever been applied with `db push`. On this database those changes already
# exist, so the renamed rows are renamed in _prisma_migrations and the new
# ones are recorded as applied -- but only after `prisma migrate diff` proves
# the live schema already matches. Any drift stops the release before the
# switch.

MODE="${1:-}"; TARGET_COMMIT="${2:-}"; SOURCE="${3:-https://github.com/sobhanzaminpeima/AIFekr.git}"
[[ "$MODE" == check || "$MODE" == deploy ]] && [[ -n "$TARGET_COMMIT" ]] || { echo "usage: $0 check|deploy <commit> [git-url-or-bundle]" >&2; exit 2; }

DB="${AIFEKR_DB:-/var/www/ai-platform/prisma/prisma/prod.db}"
BACKUPS="/var/www/aifekr-maintenance/backups"
PREVIEW_NAME="aifekr-release-preview"
PREVIEW_PORT="3046"

RENAMED=(
  "20260816_add_voice_agent_business_type:20260816_add_voice_agent_module_business_type"
  "20260826_invite_card_image:20260826_invite_to_aifekr_card_image"
)
ADDED=(
  20260918_0_create_crm_analysis_run
  20260920_0_create_lead_form_tables
  20260927_0_create_instagram_automation_tables
  20261009105959_catch_up_db_push_drift
  20261024000000_reconcile_schema_drift
)

for command in git node npm pm2 curl python3 sqlite3; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
test -s "$DB" || { echo "Production database not found: $DB" >&2; exit 1; }

pm2_field() { pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='ai-platform');if(!p)process.exit(2);const e=p.pm2_env;process.stdout.write(String($1||''))})"; }
OLD="$(pm2_field 'e.pm_cwd')"
OLD_DIST="$(pm2_field '(e.env&&e.env.NEXT_DIST_DIR)||e.NEXT_DIST_DIR||".next"')"
test -d "$OLD" && test -f "$OLD/.env.local" || { echo "Current PM2 release is invalid: $OLD" >&2; exit 1; }

SHORT="$(printf %.7s "$TARGET_COMMIT")"
NEW="/var/www/aifekr-release-${SHORT}"
DIST_DIR=".next-production-${SHORT}"
WORK="$NEW"
[[ "$MODE" == check ]] && WORK="$(mktemp -d /tmp/aifekr-check-XXXX)"

echo "Mode:            $MODE"
echo "Current release: $OLD (dist $OLD_DIST, commit $(git -C "$OLD" rev-parse --short=7 HEAD 2>/dev/null || echo 'not a git checkout'))"
echo "Target commit:   $TARGET_COMMIT -> $NEW"

if [[ "$MODE" == deploy ]]; then
  exec 9>/var/lock/aifekr-production-deploy.lock
  flock -n 9 || { echo "Another AIFekr deployment is already running." >&2; exit 1; }
  test ! -e "$NEW" || { echo "Target release already exists, refusing to overwrite: $NEW" >&2; exit 1; }
fi

git clone --quiet --filter=blob:none --no-checkout "$SOURCE" "$WORK" 2>/dev/null || git clone --quiet --no-checkout "$SOURCE" "$WORK"
git -C "$WORK" -c advice.detachedHead=false checkout --quiet --detach "$TARGET_COMMIT"

# Read-only inspection: what is live vs. what this release would change.
MODE="$MODE" DB_PATH="$DB" RELEASE="$WORK" RENAMED="${RENAMED[*]}" ADDED="${ADDED[*]}" python3 - <<'PY'
import os, pathlib, sqlite3, json
c = sqlite3.connect(f"file:{os.environ['DB_PATH']}?mode=ro", uri=True)
applied = {r[0] for r in c.execute("select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null")}
local = sorted(p.name for p in (pathlib.Path(os.environ["RELEASE"]) / "prisma" / "migrations").iterdir() if p.is_dir())
renamed = [pair.split(":") for pair in os.environ["RENAMED"].split()]
added = os.environ["ADDED"].split()
handled = {new for _, new in renamed} | set(added)
report = {
    "appliedOnServerNotInRelease": sorted(applied - set(local) - {old for old, _ in renamed}),
    "pendingRealMigrations": [m for m in local if m not in applied and m not in handled],
    "renamedStatus": {new: ("renamed already" if new in applied else "old name applied" if old in applied else "neither applied") for old, new in renamed},
    "historyRepairsPending": [m for m in added if m not in applied],
    "users": c.execute("select count(*) from User").fetchone()[0],
    "payments": c.execute("select count(*) from Payment").fetchone()[0],
    "foreignKeyErrors": len(c.execute("pragma foreign_key_check").fetchall()),
}
print(json.dumps(report, indent=2))
# A migration that is live but missing from the release means production runs
# code this commit doesn't contain; deploying it would remove that feature.
if os.environ["MODE"] == "deploy" and (report["appliedOnServerNotInRelease"] or report["foreignKeyErrors"]):
    raise SystemExit("Release is missing live migrations or the database has FK errors; deployment stopped.")
PY

if [[ "$MODE" == check ]]; then
  rm -rf "$WORK"
  echo "CHECK_OK (nothing was changed)"
  exit 0
fi

cp -p "$OLD/.env.local" "$NEW/.env.local"
cp -an "$OLD/public/." "$NEW/public/"
for dir in private-uploads; do test -d "$OLD/$dir" && cp -an "$OLD/$dir" "$NEW/" || true; done
cd "$NEW"
# Full install: the build needs dev tooling (typescript, tailwind, postcss).
npm ci
DATABASE_URL="file:${DB}" npx prisma generate
NODE_OPTIONS="--max-old-space-size=3072" NEXT_BUILD_CPUS=1 NEXT_DIST_DIR="$DIST_DIR" npm run build

mkdir -p "$BACKUPS"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUPS/pre-${SHORT}-${STAMP}.db"
DATABASE_URL="file:${DB}" node "$NEW/scripts/backup-deployment-db.cjs" "$BACKUP"
node "$NEW/scripts/verify-db-backup.cjs" "$BACKUP" "$DB"

# History repair inside one SQLite transaction; nothing in the schema changes.
for pair in "${RENAMED[@]}"; do
  old="${pair%%:*}"; new="${pair##*:}"
  sqlite3 "$DB" "begin; update _prisma_migrations set migration_name='$new' where migration_name='$old' and not exists (select 1 from _prisma_migrations where migration_name='$new'); commit;"
done
for name in "${ADDED[@]}"; do
  if ! sqlite3 "$DB" "select 1 from _prisma_migrations where migration_name='$name' and finished_at is not null" | grep -q 1; then
    DATABASE_URL="file:${DB}" npx prisma migrate resolve --applied "$name"
  fi
done

DATABASE_URL="file:${DB}" npx prisma migrate deploy
if ! DATABASE_URL="file:${DB}" npx prisma migrate diff --from-url "file:${DB}" --to-schema-datamodel prisma/schema.prisma --exit-code >/tmp/aifekr-drift.sql; then
  echo "Schema drift between production and this release; NOT switching. Diff: /tmp/aifekr-drift.sql  Backup: $BACKUP" >&2
  exit 1
fi

pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true
NEXT_DIST_DIR="$DIST_DIR" PORT="$PREVIEW_PORT" pm2 start /usr/bin/npm --name "$PREVIEW_NAME" --cwd "$NEW" -- start -- -p "$PREVIEW_PORT" -H 127.0.0.1
wait_healthy() { for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$1/api/health" | grep -q '"status":"ok"' && return 0; sleep 2; done; return 1; }
wait_healthy "$PREVIEW_PORT" || { pm2 logs "$PREVIEW_NAME" --lines 80 --nostream || true; pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true; echo "Preview unhealthy; production NOT switched." >&2; exit 1; }

rollback() {
  echo "Activation failed; restoring previous release: $OLD" >&2
  pm2 delete ai-platform >/dev/null 2>&1 || true
  NEXT_DIST_DIR="$OLD_DIST" PORT=3000 pm2 start /usr/bin/npm --name ai-platform --cwd "$OLD" -- start -- -p 3000
  pm2 save >/dev/null
}
trap rollback ERR
pm2 delete ai-platform >/dev/null
NEXT_DIST_DIR="$DIST_DIR" PORT=3000 pm2 start /usr/bin/npm --name ai-platform --cwd "$NEW" -- start -- -p 3000
wait_healthy 3000
pm2 save >/dev/null
pm2 delete "$PREVIEW_NAME" >/dev/null 2>&1 || true
trap - ERR

echo "DEPLOYMENT_OK commit=${TARGET_COMMIT} release=${NEW} backup=${BACKUP} previous=${OLD}"
