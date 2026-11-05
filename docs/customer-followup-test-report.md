# Follow-up engine: test report (2026-11-05)

Every result below is from a real run on the developer machine (Windows, Node, SQLite test databases). Nothing was run against production, and no real message was sent: delivery in the tests goes through fake adapters, and the only addresses used are `@example.invalid`.

Commit under test: `5087a3de` (branch `claude/saas-growth-20261103`).

| Check | Command | Result |
|---|---|---|
| Migration matches schema | `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma` | "This is an empty migration" (no drift) |
| Migration applies | `prisma migrate deploy` on a fresh `vitest-followup.db` | all migrations applied |
| Type-check | `tsc --noEmit -p .` | exit 0, 0 errors |
| Lint (changed areas) | `eslint src/lib/followup src/lib/growth src/components/admin/growth src/app/api/admin/{followup,growth} …` | 0 errors, 0 warnings (one purity warning fixed) |
| Follow-up unit tests | `vitest run src/lib/followup/policy.test.ts` | 15/15 passed |
| Follow-up integration tests | `vitest run src/lib/followup` (real test DB, fake adapters) | 28/28 passed (15 unit + 13 integration) |
| Full backend suite | `vitest run` | 1468 passed, 89 skipped, 1 failed (see below) |
| Production build | `next build` (`NEXT_DIST_DIR=.next-rel-5087a3de`, in `ai-platform-next16` at `5087a3de`) | ✓ Compiled successfully in 2.2 min, exit 0. Routes `/admin/customer-growth` and `/api/admin/followup` are present. |
| Admin UI, signed in (local) | Built app on `localhost:3095`, scratch copy of the test DB, local SUPER_ADMIN test account (deleted afterwards) | See "Browser check" below |

## Full-suite failure (not related)
`src/lib/voice-studio/service.integration.test.ts` › "allows exactly two free samples…" hit the 5-second timeout while 263 files shared one SQLite file. Re-run alone it passes: 17/17. The test does not touch any follow-up code.

## What the integration tests prove
1. **Engine off (the default):** nothing is planned, processing reports `disabled`, and no job rows exist.
2. **Dry run:**
   - records the intended send (`status=dry_run`, key `dry:welcome:<user>`);
   - creates no Notification and no GrowthMessage, and calls no adapter;
   - re-planning adds nothing (one open job per user, keys used once, dry-run cap).
3. **Re-check before send:** a user who unsubscribed, was suppressed (`all`) or got a first result after planning ends `suppressed` with the matching reason.
4. **Live in-app send** (all five switches on):
   - exactly one notification;
   - a GrowthMessage with the shared key;
   - the job is `sent` with its `notificationId`;
   - nothing is re-planned.
5. **Frequency cap:** an earlier send 2 h ago defers the job to exactly +22 h (`frequency_cap_per24h`).
6. **Quiet hours:** processing at Tehran 23:00 defers to Tehran 08:00 the next day.
7. **Retry/backoff:**
   - a failing email is re-queued at +15 min with the address redacted from `lastError`;
   - after `maxAttempts` the job is `failed`;
   - no GrowthMessage is written.
8. **Switching live off** cancels queued live jobs (`dry_run_mode`) before sending.
9. **Holdout 50 %:** arms match the deterministic hash, holdout users get nothing, and the report claims no lift below 30 users per arm.
10. **German user:** gets the German text.
11. **AIFekr Live:**
    - a ≥ 30 s LiveVoiceSession counts as Live first value;
    - a live conversation's assistant message is **not** counted as chat (no transcript targeting).
12. **DM link attribution:**
    - the server-side touch sets the anon cookie;
    - `linkSignup` links it and sets `intendedModule=live`;
    - the funnel shows 1 attributed user → 1 sign-up → 1 Live start → 1 first value;
    - a tenant's own site URL is never recorded.
13. **Live follow-up rule:** planned only with `live_campaign_enabled`, from day 1, and outranks the generic day-1 message.

## Browser check (local production build)
1. The Follow-up engine tab opened with "engine is off" and listed all blockers.
2. Turning the engine on in dry-run mode and saving changed the banner to dry run.
3. "Run a dry run now" recorded 2 jobs for the 4 seeded users, both `dry_run` / `in_app` and nothing sent:
   - `welcome` for the day-0 user;
   - `getting_started_24h` for the day-1 user.
   The two older users matched no rule.
4. The Send log listed both jobs with user, rule, mode and status.
5. The Campaigns tab showed the Live card: "disabled", the tracked link, and "Instagram not connected".
6. The Analytics tab loaded.
7. The browser console showed no errors.
8. At 375 px there was no horizontal page scroll (`scrollWidth` 375), and the tab strip scrolls sideways.
9. Afterwards the server was stopped, and the scratch DB, test account file and launch entry were deleted.

## Not tested here (needs credentials or approval)
- **Real email delivery** (needs `RESEND_API_KEY`, consented users and owner approval).
- **Mobile push delivery** (needs `MOBILE_*` env and devices).
- **Instagram:** a real comment → DM on AIFekr's account. That needs AIFekr's Instagram connected, a «لایو» comment campaign and the owner's go-ahead.
- **Admin UI in a signed-in browser.** The pages compile and type-check, but they were not clicked through with an admin session.
- **Production migration and deploy:** not done (owner approval required).
