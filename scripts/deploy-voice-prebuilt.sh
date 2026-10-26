#!/usr/bin/env bash
# Prebuilt, additive, feature-disabled release. Run only with a reviewed commit bundle.
set -Eeuo pipefail
commit=${1:?commit required}
[[ "$commit" =~ ^[a-f0-9]{7,40}$ ]]
old=/var/www/aifekr-release-641a202
new=/var/www/aifekr-voice-$commit
dist=.next-voice-release
backup=/var/www/aifekr-maintenance/backups/pre-voice-$commit.db
trial=/var/www/aifekr-maintenance/backups/trial-voice-$commit.db
exec 9>/var/lock/aifekr-production-deploy.lock
flock -n 9
test "$(cat "$old/RELEASE_COMMIT")" = 641a202
test ! -e "$new"
test -s /tmp/aifekr-voice-source.tar.gz
test -s /tmp/aifekr-voice-build.tar.gz
mkdir "$new"
tar -xzf /tmp/aifekr-voice-source.tar.gz -C "$new"
cp -p "$old/.env.local" "$new/.env.local"
chmod 600 "$new/.env.local"
if test -f "$old/.env"; then cp -p "$old/.env" "$new/.env"; chmod 600 "$new/.env"; fi
cp -an "$old/public/." "$new/public/"
# Each release owns its generated Prisma client. Other dependency packages are read-only symlinks.
mkdir -p "$new/node_modules/@prisma"
for dependency in "$old"/node_modules/* "$old"/node_modules/.[!.]*; do
 test -e "$dependency" || continue
 name=$(basename "$dependency")
 case "$name" in @prisma|.prisma) continue;; esac
 ln -s "$(readlink -f "$dependency")" "$new/node_modules/$name"
done
for dependency in "$old"/node_modules/@prisma/*; do
 name=$(basename "$dependency")
 if test "$name" = client; then cp -a "$dependency" "$new/node_modules/@prisma/client"; else ln -s "$(readlink -f "$dependency")" "$new/node_modules/@prisma/$name"; fi
done
if test -d "$old/private-uploads"; then ln -s "$old/private-uploads" "$new/private-uploads"; fi
if test -d "$old/tools/video-factory-renderer/node_modules"; then ln -s "$old/tools/video-factory-renderer/node_modules" "$new/tools/video-factory-renderer/node_modules"; fi
cd "$new"
tar -xzf /tmp/aifekr-voice-build.tar.gz
mkdir -p "$dist/node_modules"
while read -r name; do
 pkg=${name%-*}
 test -f "node_modules/$pkg/package.json"
 mkdir -p "$(dirname "$dist/node_modules/$name")"
 ln -s "$(realpath --relative-to="$(dirname "$dist/node_modules/$name")" "node_modules/$pkg")" "$dist/node_modules/$name"
done < <(grep -rhoE '"(@[a-z0-9._-]+/)?[a-z0-9._-]+-[0-9a-f]{16}"' "$dist/server" --include='*.js' | tr -d '"' | sort -u)
node -e "require('@next/env').loadEnvConfig(process.cwd());process.argv[2]='$backup';require('./scripts/backup-deployment-db.cjs')"
cp -p "$backup" "$trial"
DATABASE_URL="file:$trial" node node_modules/prisma/build/index.js migrate deploy
DATABASE_URL="file:$trial" node node_modules/prisma/build/index.js migrate diff --from-url "file:$trial" --to-schema-datamodel prisma/schema.prisma --exit-code
DATABASE_URL="file:$trial" node node_modules/prisma/build/index.js generate
# Explicitly pin OFF before any queue worker is installed.
node -e "require('@next/env').loadEnvConfig(process.cwd());const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const r=await p.siteSetting.findUnique({where:{key:'voiceStudioSettings'}});if(r&&JSON.parse(r.value).enabled)throw Error('VOICE_ALREADY_ENABLED_ABORT');})().finally(()=>p.\$disconnect())"
DATABASE_URL=file:/var/www/ai-platform/prisma/prisma/prod.db node node_modules/prisma/build/index.js migrate deploy
NEXT_DIST_DIR="$dist" pm2 start npm --name aifekr-voice-preview --cwd "$new" -- start -- -H 127.0.0.1 -p 3046 >/dev/null
healthy(){ for i in $(seq 1 30); do if curl -fsS "http://127.0.0.1:$1/api/health" | grep -q '"status":"ok"'; then return 0; fi; sleep 1; done; return 1; }
healthy 3046
for path in / /en /tr /de /login /pricing; do curl -fsS "http://127.0.0.1:3046$path" >/dev/null; done
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3046/api/voice-studio)" = 401
old_dist=.next-production-641a202
rollback(){ pm2 delete ai-platform >/dev/null 2>&1 || true; NEXT_DIST_DIR="$old_dist" pm2 start npm --name ai-platform --cwd "$old" -- start -- -H 127.0.0.1 -p 3000 >/dev/null; pm2 save >/dev/null; }
trap rollback ERR
pm2 delete ai-platform >/dev/null
NEXT_DIST_DIR="$dist" pm2 start npm --name ai-platform --cwd "$new" -- start -- -H 127.0.0.1 -p 3000 >/dev/null
healthy 3000
pm2 delete aifekr-voice-preview >/dev/null
printf '%s\n' "$commit" > RELEASE_COMMIT
pm2 save >/dev/null
trap - ERR
echo VOICE_RELEASE_OK_GENERATION_DISABLED
