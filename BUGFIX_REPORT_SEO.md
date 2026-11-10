# AIFekr bugfix report: Part C, SEO (master prompt of 2026-11-09)

Backend branch `claude/bugfix-seo-20261110`, UI branch `claude/ui-bugfix-seo-20261110`. **Neither is pushed or deployed.**
Kept separate from `BUGFIX_REPORT.md` because another session is working on the other parts at the same time. Merge the two when the branches are merged.
Production was only read (read-only connection), and only scores and counts were printed.

## Done

### Issue 18: paid SEO output was never saved. Confirmed and fixed
- **Root cause:** `/api/seo/analyze`, `/improve` and `/suggest` charged and answered but wrote nothing. Saved audit plans and pipeline posts were already stored.
- **Fix:** new additive table `SeoGeneration` (migration `20261110130000_seo_generation`), `lib/seo/generationHistory.ts`, and `GET`/`DELETE /api/seo/generations`, scoped to the signed-in user. The new design shows saved results in the content library and on each tool tab, with open, copy, download and delete. The classic `/seo` page lists and reopens them.
- **Behaviour:** generation continues and is saved if the user closes the page. A model failure midway keeps what arrived, marked partial. A failed save never breaks the answer.
- **Tests:** `api/seo/analyze/route.test.ts` and `api/seo/generations/route.test.ts`, passing.
- **Not verified:** the screens have not been run in a browser against a signed-in account. The migration has run only on the test database. No real model call was made.

### Issue 22: Content Writer could not write from a topic. Fixed
Page text is now optional. Empty text writes a full article from the keyword; supplied text is optimized as before. Both themes. Covered by two tests in `api/seo/analyze/route.test.ts`.

### Issue 24: launch dialogs. Partly refuted, action fixed
The dialog already has `max-height: 85dvh` and scrolls, so it does not exceed the viewport. The submit button sat below the fold, and is now sticky inside the dialog. This applies to every `LiveForm`. Prior results now appear on the tab (Issue 18). Inputs remain in the dialog. CSS only: no automated test is practical, and it has not been checked in a browser.

## Open

### Issue 19: admin and user scores. Not reproduced
- **User side is correct.** The stored audit of 2026-11-05 for aifekr.com is score 94, 36 warnings, 10 pages, 0 errors. khoonekala.com's latest stored score is 89. Both match what the user page showed.
- **Admin side not found.** 80 / 8 / 8 and 74 / 1 / 7 match no stored audit of those sites, and neither repository has code that produces them from audits. `/api/admin/seo-intelligence` reads only provider config and `SeoResearchJob`, which has 0 rows.
- **Needed:** the response of the network requests made by `/admin/seo-intelligence` from a signed-in admin session, or a screenshot showing which panel holds those numbers. No fix was guessed.
- **Note:** aifekr.com is tracked as two separate site rows by two accounts, so two different scores for it can both be correct.

## Findings so far, not fixed
- **Issue 25:** production has 0 `UsageLog` rows of type `seo`; SEO usage is inside the 141 `tool` rows. The missing per-module split is confirmed.
- **Issue 26:** `SeoResearchJob` has 0 rows and audits come from the built-in crawler, so an empty DataForSEO log is accurate for past audits. Provider logging for future calls was not reviewed.
- `/api/seo/analyze` keeps the charge when the page cannot be loaded (`tool: "url"`): the failure is reported inside a 200 stream. Billing behaviour, left for the owner.

## Not started
Issues 20 and 23; the fixes for 25 and 26.

## Other
`tsc` reports two errors in `src/lib/navigation/shortRoutes.test.ts`, from commit `2a7714f3` on the other branch, not from this work.
