# AIFekr bugfix report (master prompt of 2026-11-09)

Branch `claude/bugfix-master-20261110`, based on `main` at `cd2af26c`. **Nothing here is deployed or pushed.**
Production was only read (read-only connection), and only counts or non-personal fields were printed.

Status: 4 of 46 issues investigated to a conclusion, 0 of 15 roadmap items started. This file is updated as work continues.

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

## In progress

### Issue 30: dead routes
`/image-studio` and `/sales-agent` do not appear in either repo's source, so the picker links probably come from database records. Not concluded yet.

## Not started
Issues 1, 2, 4, 5, 6, 7, 8, 9-26, 31-46, and E1-E15.

## Related, already released before this branch
- Issue 5 (Prisma transaction error): partly addressed by WAL mode and `lib/db/retry.ts` (2026-11-05). Not yet re-checked against the 17 Aban error.
- Issue 39/21 ("high cost" copy): not yet addressed.

## Config TODOs for the owner (report only, untouched)
- Approved FX rates (Toman, Lira, Euro) have expired; several packages lack fixed Lira or Euro prices.
- NowPayments webhook and YouTube publishing are unconfigured.
- Server disk: about 2.9 GB free; database backups take 1.2 GB.
