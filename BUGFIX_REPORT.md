# AIFekr bugfix report (master prompt of 2026-11-09)

Branch `claude/bugfix-master-20261110`, based on `main` at `cd2af26c`. **Nothing here is deployed or pushed.**
Production was only read (read-only connection), and only counts or non-personal fields were printed.

UI changes are on branch `claude/ui-bugfix-20261110` of the UI repository, based on `main` at `494aa3c`, also neither pushed nor deployed.

Status: 10 of 46 issues concluded (3, 21, 27, 28, 29, 30, 31, 37, 39, 40), 0 of 15 roadmap items started. This file is updated as work continues.

## Done

### Issue 28: student assistant answered with other content. Leak refuted; real bug fixed (`a0612b61`)
- **Not a cross-user leak.** Course and material queries filter by user and course, and `lib/ai/router.ts` keeps no response state (only a provider cooldown map). The production note's account had one 4,800-character material in that course containing "Cyprus", "Meta", "Google", "SEO" and "90". No other user has material mentioning Cyprus.
- **Root cause:** the student's own material came before the question, and `understand` mode said "explain the assignment brief", so the model summarised the material. The student was still charged.
- **Fix:** `lib/student/assistantContext.ts`. The request is now the task and materials are optional background (assignment and thesis assistants). An answer that shares no topic word with the request but repeats the materials is neither saved nor charged (`OFF_TOPIC_ANSWER`).
- **Tests:** `assistantContext.test.ts` and `assignment-assist/route.test.ts` (10 tests, passing): user scoping, two questions back to back, no charge when off topic.
- **Limit:** the off-topic check is deliberately conservative. No real model call was made.

### Issue 3: voice credits "100% refunded". Charging bug refuted; report fixed (`212c9bcf`)
- **Data:** all 55 production generations are READY, none failed. Paid ones hold the estimate, charge the real duration and release the rest, for example held 100, charged 50, released 50. Total: held 470, charged 235, released 235. The ledger entries match (SPEND -200, REFUND +100 for the two generations made since the ledger existed).
- **Root cause:** the admin report added released holds to "refunded".
- **Fix:** `lib/voice-studio/reporting.ts`; the admin report now shows released holds and real refunds separately.
- **Tests:** `reporting.test.ts` (3, passing). The hold, settle and release lifecycle is already covered by `service.integration.test.ts`.
- **Observation for the owner (not changed):** the hold is 2 intervals even for very short text (a 3.8 s estimate held 90 credits). A user with a low balance could be refused although the real charge would fit.

### Issue 27: fitness coach selection crash. Fixed (`2391012a`)
- **Root cause:** `preferences` called `fitnessProfile.update` on a profile that did not exist, and the route returned the raw Prisma message.
- **Fix:** with no profile, it answers `FITNESS_PROFILE_REQUIRED` with a clear message. `lib/fitness/errors.ts` masks database and validation errors.
- **Not done as suggested:** no implicit upsert. `age`, `goal` and `consentAt` are required health-data fields, and an upsert would invent them.
- **Partly refuted:** the profile form exists; `LiveForm` opens it in a dialog from that button.
- **Tests:** `api/fitness/route.test.ts` (3, passing).

### Issue 29: voice free trial missing from the UI. Refuted, no change
Production has 50 trial samples from 32 users. The UI shows a trial banner and a free-sample state (`components/live-voice.tsx`) when the account has no plan access and has trials left. The audit used a Super Admin, which has plan access, so trials are hidden by design.

### Issue 30: dead routes. 404s removed; the card source was not reproduced
- **Evidence:** the design's cards in `module-directory.tsx` and `lib/live.ts` already use real routes. `/image-studio` is in neither repository, and `/sales-agent` exists only as an agent key. Which screen showed those links could not be identified without a signed-in production session.
- **Fix:** `lib/navigation/shortRoutes.mjs` and `next.config.mjs` send all eight dead addresses to their real pages with temporary redirects, including `/startup` and `/games`, so those two registry modules are reachable.
- **Tests:** `shortRoutes.test.ts` (9, passing) fails if a destination stops being a real page.

### Issue 31: saved reports could not be opened. Fixed (UI `06f580d`)
- **Evidence:** all 10 production Business Doctor rows hold a non-empty report, so the data was there. The report rendered below the list without coming into view, and the CEO action left the page for `/chat/<id>`.
- **Fix:** `LiveReportPanel` and `LiveSavedConversation` in `live-module-kit.tsx`. Business Doctor, CEO and Meeting open saved items the same way: inline, scrolled into view, closable.
- **Not verified:** typecheck passes, but the click has not been run in a browser against a signed-in account.

### Issue 37: raw ISO timestamps. Fixed (UI `06f580d`)
`LiveTable` formats timestamps centrally through `lib/live-format.ts`, and accounting forecast months read as month names. `tests/live-format.spec.ts` (3, passing). Pages that do not use `LiveTable` were not swept.

### Issue 40: raw Markdown. Fixed (UI `06f580d`)
`components/ai-text.tsx` renders AI text in the streaming tool, advisory reports, the student assistant and startup results. Raw HTML in model output stays inert.

### Issues 21 and 39: "high cost" copy. Fixed (UI `06f580d`)
`live-stream-tool.tsx` now states the exact credits, from the same `/api/credits/costs` value shown above the button.

## Not started
Issues 1, 2, 4, 5, 6, 7, 8, 9-20, 22-26, 32-36, 38, 41-46, and E1-E15.

Issue 46 needs a real chat turn on a quiet account to reconcile, which is a paid provider call. It has not been run.

## Related, already released before this branch
- Issue 5 (Prisma transaction error): partly addressed by WAL mode and `lib/db/retry.ts` (2026-11-05). Not yet re-checked against the 17 Aban error.

## Config TODOs for the owner (report only, untouched)
- Approved FX rates (Toman, Lira, Euro) have expired; several packages lack fixed Lira or Euro prices.
- NowPayments webhook and YouTube publishing are unconfigured.
- Server disk: about 2.9 GB free; database backups take 1.2 GB.
