# Deployment & Rollback

**Not deployed yet** — this branch (`feat/customer-growth`) needs the owner's approval for production.

## Steps (same process as previous releases)

1. Back up and verify the production database (`scripts/backup-deployment-db.cjs` + `scripts/verify-db-backup.cjs`).
2. Apply the additive migration on the server: `npx prisma migrate deploy` (creates 6 `Growth*` tables only; no existing table changes).
3. Build locally in the `ai-platform-next16` worktree with a new `NEXT_DIST_DIR`, upload, link the Turbopack external aliases, start the preview on port 3046, smoke-test `/`, `/features/voice-studio`, `/register?redirect=/voice-studio`, `/admin/customer-growth`.
4. Switch pm2 `ai-platform` to the new dist dir (automatic rollback on failed health check).
5. Optional, only after reviewing the Automations preview: add a cron entry (e.g. every 2 hours)
   `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/cron/growth-lifecycle`
   Nothing is sent until a SUPER_ADMIN enables both lifecycle flags and at least one rule.

## Environment variables

No new variables. Uses existing `JWT_SECRET` (unsubscribe signatures), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`/public URL helper, Resend settings for email.

## Rollback

- Code: switch pm2 back to the previous dist dir (`.next-voice-b89eea5`).
- Behaviour without code rollback: turn off flags in Admin → Customer Growth → Settings (tracking, onboarding, upgrade card, automation are each independent).
- Data: the new tables are unused by older builds and can stay. Dropping them is destructive and needs explicit approval.
