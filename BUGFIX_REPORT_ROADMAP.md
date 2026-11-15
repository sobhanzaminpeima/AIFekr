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

## Round 2 (branch `claude/roadmap2-20261115`, from main `cb631872` / UI `b298fa0`)

Requested by the owner: "E8 E7 E12 E4 E5 E10 E14 E15". **No migration in this round.** Not run in a browser against a signed-in account; no Instagram, WordPress, Meta or model call was made.

| Item | Added in round 2 | Tests | Still left |
|---|---|---|---|
| **E12** | Admin page `/admin/observability` (new design, admins only) shows each signal with a verdict, plus the trial list. Added to the admin menu under settings and infrastructure. | typecheck; theme routing tests | Live provider test calls. |
| **E7** | One builder form creates an automation in the system that runs it: comment-to-DM campaign, DM keyword rule, or CRM rule, through that system's own API and plan checks. Pause and resume from the unified list. | `tests/automation-builder.spec.ts` | Dry run against past events, a per-run log, and folding in the follow-up engine. |
| **E10** | Three recipes fill the builder: Instagram keyword campaign, idle-lead follow-up, welcome DM. The "unpaid checkout reminder" is a follow-up engine rule (owner-managed), so no user recipe was made for it. | same spec | — |
| **E8** | `PATCH /api/social/instagram/schedule/<id>` edits a waiting post; only still-waiting rows change. A month calendar in the studio's calendar tab: drag a post to another day (it keeps its time of day), tap it to edit, and upload an image through the existing upload API. | `lib/instagram/scheduleEdit.test.ts`, `tests/social-calendar.spec.ts` | The calendar shows the latest 20 posts the status API returns. Video upload is not covered (the upload API takes images up to 8 MB). Without public storage, an upload is refused with an explanation, because Instagram needs a public link. |
| **E5** | A first-run checklist on the home page, ticked from real activity (chat, a creation, a connection, an automation) and hidden once all are done. Ready examples for Business Doctor and Meeting. | `tests/first-run.spec.ts` (walkthrough) | Examples for the student assistants. |
| **E4** | `GET /api/admin/trials` and a trials list on the health page: voice as configured, every other module "not offered". | `lib/trials/catalog.test.ts` | **Owner decision:** whether other modules get free uses, and how many. Code switches nothing on, because free uses are a pricing decision. |
| **E14** | A saved SEO article or meta result goes to the user's WordPress **as a draft** in one click (`POST /api/seo/generations/<id>/wordpress`); publishing stays the owner's step in WordPress. | `lib/seo/toWordpress.test.ts` | **Owner action:** choose the Search Console site (production has a connection with no site), so traffic and rankings can fill. |
| **E15** | A finished or failed Video Factory job notifies its owner once, with a link to the project. Finished films appear in the library. Runs when the library opens and from `GET /api/cron/factory-notify`. The factory pipeline files were not touched. | `lib/video-factory-hooks/finished.test.ts` | **Release action:** a crontab entry for `/api/cron/factory-notify` (every few minutes, with the cron secret), so the notification also arrives with the tab closed. Live progress inside the factory is for the factory session. |

### Leftover small bugs (asked with round 2)

| Issue | Result |
|---|---|
| 44, truncated automation description | **Not reproduced.** The full text is in the dictionaries (fa and en end in a full sentence) and no style clips it in the current UI. |
| 44, unexplained "10.2" | **Already explained.** It is the site size, in a column labelled "Size (KB)". |
| 44, music style pictures | **Fixed.** Music tiles cycled three generic pictures (a planet for «سنتی ایرانی»); they now show the genre name only. |
| 44, delayed "New project" | **Fixed.** The link waited for the address change before opening the empty wizard; it now opens it on click. |
| 45, Live's slow first paint | **Fixed on screen.** Live showed a bare "…" until all setup values arrived; it now shows its frame, a disabled microphone and "Getting your conversation ready…" at once. The setup itself only reads the database; its real duration could not be measured without a signed-in account. |

### Round 2 verification
Typecheck is clean in both repositories. The full backend suite passes (1,692 tests, 102 skipped). The UI production build succeeds and all 124 UI specs pass, rerun after the leftover-bug fixes.
