# Testing Report — 2026-10-28

## Automated

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | Pass |
| `npx eslint` on all changed/new files | 0 errors; 1 pre-existing warning in `src/app/welcome/page.tsx` (legacy wizard, line 49) |
| `npx vitest run src/lib/growth` | 20 / 20 passed (new `growth.test.ts`) |
| `npx vitest run src/lib/growth src/lib/voice-studio src/lib/ai src/app/api/payment src/app/api/auth` | 19 files, 131 tests passed |
| `npx vitest run` (full suite) | 1,270 passed, 87 skipped, **2 failed** in `src/lib/fitness/adminAccess.integration.test.ts` — the same 2 fail with all changes stashed (pre-existing, expected 200 got 403), unrelated to this work |

New unit tests cover: UTM/referrer parsing, open-redirect guard, path→module mapping, client event allowlist (no financial/success events), metadata minimisation, stage transitions, server-confirmed paid status, score normalisation and once-per-window rules, bands, configurable segments, template variables and injection, Tehran quiet hours, promotional rules never targeting paying users, real-package recommendation (no invented plan), Voice Studio trial (default off, capped duration), CSV formula neutralisation.

## Manual verification (local preview, port 3073, local SQLite copy)

| Scenario | Result |
|---|---|
| Signed-out visit to `/voice-studio?project=x` | 307 → `/login?redirect=%2Fvoice-studio%3Fproject%3Dx` |
| `/features/voice-studio` landing | 200; CTA `/register?redirect=%2Fvoice-studio` |
| Campaign touch beacon | Touch stored (instagram / paid_social / voice_studio_launch, referrer host only), 36-char `afk_aid` cookie |
| Forged `payment_succeeded` client event | Rejected 400 |
| Test signup with `redirect=/voice-studio` + consent | Response `redirect: /voice-studio`; profile `utm / voice-studio / contextual / consent=signup`; events `landing_viewed → user_signed_up → consent_granted`; onboarding wizard skipped |
| Voice Studio access for FREE user | `planAllowed=false, trialRemaining=0` (default); `trialRemaining=1` after enabling the trial locally |
| Upgrade API | Real `PRO` package: 350,000 Toman, 6,000 credits, 30 days, checkout URL with `returnTo=/voice-studio` |
| Admin Growth Center | Overview (12 KPI tiles, funnel), campaigns (`voice_studio_launch` 1 visit / 1 signup; CAC N/A), customers (8, stage/score/source), automations preview (`dryRun: true`), Customer 360 (timeline, next action), CSV export (SUPER_ADMIN) all 200 |
| Messages sent during testing | 0 `GrowthMessage`, 0 growth notifications |

## Not verified

- A real Voice Studio generation (local private storage is not configured), so `first_voice_generated` was verified by code path and unit logic only.
- Real payment round-trip back to `/voice-studio` (no live payments).
- Email delivery of lifecycle messages (sending is off by default).
- Visual screenshots of the admin pages at desktop width (the browser pane did not repaint; content was verified through the DOM and API).
