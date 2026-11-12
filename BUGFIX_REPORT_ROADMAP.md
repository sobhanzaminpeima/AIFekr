# AIFekr roadmap report: Part E (master prompt of 2026-11-09)

Branch `claude/roadmap-20261111` in both repositories, cut from the live heads (backend `80e0f802`, UI `1b43420`). **Nothing here is pushed or deployed.**
Each item below is a first working slice with tests, not the whole roadmap item; what is left is listed per item.

**Not verified:** no screen was run in a browser against a signed-in account, and no Instagram, Meta or model call was made.

## Migrations (both additive)
- `20261112090000_inbound_event`: new table `InboundEvent` (E6).
- `20261112100000_scheduled_post_attempts`: `ALTER TABLE "ScheduledPost" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0` (E8). This is a column, not a table. Check that the release's additive-migration script accepts `ADD COLUMN` before relying on it.

## Done (first slices)

| Item | What exists now | Tests | Left |
|---|---|---|---|
| **E2** credit ledger and idempotency | Paid tool routes accept an `Idempotency-Key`; a repeated key is refused before any charge (409 `DUPLICATE_REQUEST`) and released after a refunded failure. `GET /api/user/credit-ledger` gives the user's own ledger (type, amount, balance after, receipt id, paging). The credits page shows it; forms and streaming tools send one key per submission. | `withToolCredits.idempotency.test.ts`, `user/credit-ledger/route.test.ts` | Routes outside `withToolCredits` (chat, media, voice) do not read the key yet. The guard is in-memory, so it is per process. |
| **E3** connection health | `GET /api/connections/health`: Instagram (expired / expiring in 7 days), Search Console (no site chosen), WordPress (incomplete). Panel in the studio's connections view. | `lib/connections/health.test.ts` | Admin-wide view across accounts; live checks are still per connection. |
| **E6** event log | Every Instagram webhook event is logged with type, account, outcome and latency, and **no message or comment text**. Rejected signatures are logged too. `GET /api/admin/events`. | `lib/events/inbound.test.ts`, existing webhook tests | Admin UI page, a dead-letter queue and retries, and a "simulate event" button. Other sources (lead forms, CRM) are not logged yet. |
| **E7** one automation surface | `GET /api/automations` reads Instagram comment campaigns, DM rules and CRM rules as one trigger → condition → action list. Shown in the studio campaigns tab and CRM automations. | `lib/automation/unified.test.ts` | The builder itself: create, edit and pause in one place, dry run, run log, and folding in the follow-up engine. |
| **E8** publishing scheduler | A post that fails at Instagram is retried once after 10 minutes; the owner is told only when the retry also fails. | `lib/instagram/publishRetry.test.ts` | Media upload, a month calendar with drag-to-reschedule, editing a queued post. |
| **E9** campaign funnel | Each campaign row now starts with comments → DMs sent (and failed) → link clicks, from comment campaigns whose link carries its UTM, before the existing visits → sign-ups → payments. | `lib/growth/commentFunnel.test.ts` | Weekly auto-report. |
| **E1** creation library | `GET /api/library`: one newest-first index of images, videos, music, voice, SEO results and websites, each with where it opens. Shown at the top of the gallery. | `lib/library/index.test.ts` | Search, share links, and advisory reports (Business Doctor, CEO, Meeting), which have no shared model yet. |
| **E4** free trials | `GET /api/trials`: one list of trials, counted by the same code that enforces them. Voice is the only trial today. | `lib/trials/registry.test.ts` | Per-module trial configuration in admin, and trials for other modules. |
| **E5** first run | Forms can load a ready example in one click; the SEO tools offer one. (The inline contact in the deal dialog was Issue 41.) | typecheck only | Examples for other modules, a first-run checklist, and a scripted new-user walkthrough test. |
| **E11** output guardrails | The assignment and thesis assistants neither save nor charge an answer in the wrong language, alongside the existing off-topic check (Issue 28). | `lib/ai/outputSanity.test.ts` | Other assistants; canary tests in CI. |
| **E12** owner observability | `GET /api/admin/observability`: provider fallback rate, errors by source, inbound event health, untokenized text requests and approved FX-rate freshness, each with a verdict. Stored data only. | `lib/admin/observability.test.ts` | Admin page; live provider test calls. |
| **E13** localization gate | `tests/i18n-parity.spec.ts` fails when an interface key is missing in a language, or when a table prints a raw ISO time. It found **80 of 108 German keys missing**; they are now translated. | the spec itself | Enum and label dictionaries outside `lib/i18n.ts`, and Markdown rendering checks. |

## Not started, with what they need

| Item | Needs first |
|---|---|
| **E10** automation recipes | The E7 builder writing automations, so a recipe can install one. |
| **E14** SEO → content → publish | Sending a saved SEO result to WordPress or the scheduler, and the Search Console connection completed by the owner (one connection has no site selected). |
| **E15** long-job experience | Video Factory jobs reporting progress and finishing into the library (E1) with a notification. |

## Verification
Typecheck is clean in both repositories. The full backend suite passes (1,625 tests, 102 skipped; one test failed on a first run and did not repeat). The UI production build succeeds and all 113 UI specs pass, including the new localization gate.
