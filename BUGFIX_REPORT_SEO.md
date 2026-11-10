# AIFekr bugfix report: Part C, SEO (master prompt of 2026-11-09)

Backend branch `claude/bugfix-seo-20261110`, UI branch `claude/ui-bugfix-seo-20261110`. **Neither is pushed or deployed.**
Kept separate from `BUGFIX_REPORT.md` because another session is working on the other parts at the same time. Merge the two when the branches are merged.
Production was only read (read-only connection), and only scores, counts and yes/no configuration states were printed.

Status: 7 of 8 Part C issues concluded (18, 20, 22, 23, 24, 25 in part, 26 in part). Issue 19 is open. Issue 21 was closed on the other branch.

**Not verified anywhere in this report:** none of the screens has been run in a browser against a signed-in account, and no real model or provider call was made. The UI build, typecheck and listed tests pass.

## Done

### Issue 18: paid SEO output was never saved. Confirmed and fixed
- **Root cause:** `/api/seo/analyze`, `/improve` and `/suggest` charged and answered but wrote nothing. Saved audit plans and pipeline posts were already stored.
- **Fix:** new additive table `SeoGeneration` (migration `20261110130000_seo_generation`), `lib/seo/generationHistory.ts`, and `GET`/`DELETE /api/seo/generations`, scoped to the signed-in user. The new design shows saved results in the content library and on each tool tab, with open, copy, download and delete. The classic `/seo` page lists and reopens them.
- **Behaviour:** generation continues and is saved if the user closes the page. A model failure midway keeps what arrived, marked partial. A failed save never breaks the answer.
- **Tests:** `api/seo/analyze/route.test.ts` and `api/seo/generations/route.test.ts`, passing.
- **Limit:** the migration has run only on the test database.

### Issue 20: rank and research tools could not be started. Refuted in substance, label fixed
The backend jobs and the launch flow exist, and production has the provider enabled with credentials and all 8 rates set. The start control was the button labelled "Preview cost", followed by a confirmation, so it did not read as a start. It is now "Start research: preview cost", with a line explaining the two steps. Production has 0 research jobs, so a real run has never been observed. Label only: no automated test.

### Issue 22: Content Writer could not write from a topic. Fixed
Page text is now optional. Empty text writes a full article from the keyword; supplied text is optimized as before. Both themes. Covered by two tests in `api/seo/analyze/route.test.ts`.

### Issue 23: market and language controls. Partly refuted, memory added
Market and language selectors already exist in the research form, filled from the provider's catalogue. What was missing is persistence: the last market run for a site is now preselected, read from that site's research jobs, so no schema change was needed (`lastSeoMarket`, `tests/seo-contract.spec.ts`, 3 passing). The site audit is our own crawler and does not query a search market, so no selector applies there.

### Issue 24: launch dialogs. Partly refuted, action fixed
The dialog already has `max-height: 85dvh` and scrolls, so it does not exceed the viewport. The submit button sat below the fold, and is now sticky inside the dialog. This applies to every `LiveForm`. Prior results now appear on the tab (Issue 18). Inputs remain in the dialog. CSS only: no automated test.

### Issue 25: cost figures. Cost and module split fixed; placeholders open (`eda8c57c`)
- **Root cause of two figures:** the summary card showed the output of the what-if token calculator at its default rates, and Unit Economics showed the sum recorded per request.
- **Fix:** the card now shows the recorded figure, and the calculator shows its own result, labelled hypothetical.
- **Usage per module:** `/admin/usage` now splits by module. All text tools share the type `tool`, so the module comes from the recorded feature (`lib/admin/usageModules.ts`, tests passing).
- **Missing tokens:** media requests are billed by the unit and no longer count as missing. Past text rows cannot be backfilled, because the numbers were never recorded; the banner says so.
- **Open:** the `؟؟` values could not be found in either repository. It needs the same evidence as Issue 19.

### Issue 26: Search Console and provider log. State fixed; logging and sign-in open
- **Provider log:** `SeoResearchJob` has 0 rows and audits come from the built-in crawler, so the empty log is accurate. Every paid provider call creates a job row. Free calls (market catalogue, account check) are not logged; recommended under roadmap item E12 rather than as a new table here.
- **Search Console:** production has one connection with no site selected, which is why traffic is empty. The page printed raw JSON. It now states one of three conditions, and the overview shows the same state with a link to finish setup.
- **Not verified:** the Google sign-in flow needs a real Google account and was not run.

## Open

### Issue 19: admin and user scores. Not reproduced
- **User side is correct.** The stored audit of 2026-11-05 for aifekr.com is score 94, 36 warnings, 10 pages, 0 errors. khoonekala.com's latest stored score is 89. Both match what the user page showed.
- **Admin side not found.** 80 / 8 / 8 and 74 / 1 / 7 match no stored audit of those sites, and neither repository has code that produces them from audits. `/api/admin/seo-intelligence` reads only provider config and `SeoResearchJob`, which has 0 rows.
- **Needed:** a screenshot of `/admin/seo-intelligence` showing those numbers, or its network responses from a signed-in admin session. No fix was guessed.
- **Note:** aifekr.com is tracked as two separate site rows by two accounts, so two different scores for it can both be correct.

## For the owner
`/api/seo/analyze` keeps the charge when the page cannot be loaded (`tool: "url"`), because the failure is reported inside a 200 stream. Billing behaviour, left unchanged.

## Other
- The UI commit for Issues 20, 23 and 26 is one commit because all three edit the same component.
- `tsc` reports two errors in `src/lib/navigation/shortRoutes.test.ts`, from commit `2a7714f3` on the other branch, not from this work.
