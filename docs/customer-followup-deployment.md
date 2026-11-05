# Follow-up engine: deployment

**Not deployed.** Deploying, and turning on any outreach, needs the owner's explicit approval.

## What ships
- **Migration** `prisma/migrations/20261105120000_followup_engine`. It is additive: two new tables (`FollowupJob`, `FollowupSuppression`), with no change to existing tables.
- **Code:**
  - `src/lib/followup/*`;
  - `/api/admin/followup`;
  - new admin tabs;
  - Live facts;
  - `/live` return path;
  - server-side DM-link touch;
  - de/tr templates.
- **Behaviour change in `/api/cron/growth-lifecycle`:** it now runs the follow-up engine. With the default settings (engine off) it plans and sends nothing, the same outcome as today, where both growth flags are off.
- **No UI-repo change.** The new design already sends the landing beacon on `/live`, and admin is in the backend.

## Steps (paired release procedure, see memory `release-procedure.md`)
1. `git fetch`. Compare `origin/main` with the live `RELEASE_COMMIT`, and check `pm2 jlist`.
2. Back up the database with `backup-deployment-db.cjs` only (prod DB is WAL). Never `cp`.
3. Prisma runtime for the new models:
   - copy the current `/var/www/aifekr-prisma-<sha>` runtime;
   - put this schema in its `prisma/`;
   - run `prisma generate`;
   - relink every `node_modules/@prisma/client*` link of the release (including the hashed `client-<16hex>` name).
4. Apply the migration with `scripts/apply-additive-migration.cjs`:
   - cwd = release folder;
   - `NODE_PATH=<release>/node_modules`.
5. Preview on :3046 and run the read-only verify script. Then switch, with automatic rollback.
6. Check (read-only):
   - `/admin/customer-growth#followup` shows "engine is off";
   - the hourly cron response has `"mode": null`;
   - `sqlite3 'file:prod.db?mode=ro' "select count(*) from FollowupJob"` returns 0.

**No new cron entry is needed.** `growth-lifecycle` is already hourly; check `/etc/cron.d` and the root crontab before changing it.

## Enabling (only after owner approval in that session)
1. Admin → Follow-up engine: engine on, **dry run**. Watch the logs for a few days.
2. For real sends, a SUPER_ADMIN enables:
   - both growth flags;
   - selected rules;
   - mode `live`;
   - the in-app channel.
3. **Email** additionally needs `RESEND_API_KEY` and verified sending. Users are reached only with explicit consent.
4. **Push** additionally needs `MOBILE_API_ENABLED` + `MOBILE_PUSH_ENABLED`, plus the mobile push dispatcher.
5. **Live campaign:** a SUPER_ADMIN switches it on, then the owner creates the «لایو» comment campaign with the tracked link in the workspace where AIFekr's Instagram is connected.

## Rollback
- **Instant, no deploy:** Admin → Follow-up engine → engine off (queued live jobs are cancelled on their next attempt), or "Cancel all queued".
- **Code:** switch back to the previous release. The two new tables can stay, since they are unused by old code.
