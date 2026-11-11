# AIFekr bugfix report: remaining issues, batch 1 (master prompt of 2026-11-09)

Branch `claude/bugfix-rest-20261111` in both repositories: backend from live `2e00f87f`, UI from live `a316d2b`. **Neither is pushed or deployed.**
Production was only read (read-only connection); only counts, dates and scrubbed error text were printed.

**Not verified anywhere in this batch:** no screen was run in a browser against a signed-in account, and no real Instagram, Meta or model call was made. Typecheck passes in both repositories. The full backend suite passes (1,592 tests, 102 skipped); the UI production build succeeds and all 109 UI specs pass. Tests are listed per issue.

## Part B, Instagram studio

| Issue | Result |
|---|---|
| 9, account card | **Fixed.** `GET /api/social/instagram/status?profile=1` returns the live profile (picture, name, bio, followers, following, posts), connection date and token expiry; a failure is reported, not shown as an empty card. The card shows Connect only when nothing is connected; Refresh shows the update time. Tests: `lib/instagram/profile.test.ts`, `api/social/instagram/status/route.test.ts`. |
| 10, "no data" above a full table | **Fixed.** Each table has its own heading and empty line; the follower trend (recorded daily) no longer prints the generic line above the posts table. |
| 11, empty inbox | **Root cause found in data, not fixable in code.** The last Instagram event of any kind reached production on 2026-10-05 (6 DMs, all `skipped`; last comment log 2026-10-03). Events stopped arriving, so the inbox cannot fill. The inbox now states whether delivery is on, whether access is valid, and when the last event arrived. **Owner action:** run the health check under "Connection & webhooks" and re-enable events or reconnect. |
| 13, scheduling | **Partly fixed.** The auto-publish worker exists and is scheduled (`/api/cron/instagram-publish`). Auto mode is absent on the STUDENT plan by design (`canAutoPublish`: Pro/Team); the studio now says so and links to plans, and the queue has a heading and empty state. **Not done:** media upload and a calendar grid (roadmap E8). |
| 14, content creation | **Mostly already present** on the live UI (Studio, quality, image analysis, ideas). **Added:** generated drafts hand off to the publishing queue, and the studio prompt includes the brand identity. |
| 15, stats | **Fixed:** summary tiles (followers, posts, growth, engagement) from data the API already returned, a follower trend chart, and clamped captions so the type column no longer overlaps. **Not reproduced:** the previous-tab flash; each tab view is keyed and remounts. |
| 16, competitors and brand | **Fixed.** The paid competitor analysis is replaced by an explanation while its data source is off (the API already refused and refunded without data). An unset brand is an empty state with a next step, not a row of dashes. |
| 17, second account | **Real defect fixed.** Logging in with a different Instagram account in the same workspace silently replaced the connected one and **deleted its campaigns, logs, history and queue**. The callback now refuses with a clear message (one account per workspace; a second account goes in its own workspace; switching is an explicit disconnect). Test: `lib/instagram/ownership.test.ts`. |

## Part A

| Issue | Result |
|---|---|
| 1, campaign state | **Fixed.** `liveCampaignActivation()` is the single source; the table and the card show the same running state with reasons. **Production finding:** the Live campaign record is `active`, but no «لایو» comment campaign exists on any account, so it has not been running. Test: `lib/followup/liveActivation.test.ts`. |
| 2, Instagram DM unavailable | **Copy fixed.** The engine's switch only adds follow-ups; the DM is Social Studio's Comment-to-DM. The switch label and the channel row now say this in four languages. |
| 6, two campaign stores | **Intentionally separate, documented.** Customer growth holds tracking labels (UTM); Social Studio holds the automation, per account and workspace. The Super Admin's workspace has no comment campaigns (the 3 that exist belong to another admin), which is why the studio lists were empty. The Live card now points to the studio. |
| 5, transaction error | **Fixed.** Six "Transaction already closed" errors in chat bookkeeping (2026-10-31 to 11-08) came from the chat charge's interactive transaction hitting Prisma's 5 s default under SQLite contention, leaving answers uncharged. It now uses the app's `BUSY_TX` limits and retries an expired attempt. Test: `lib/utils/chargeRetry.test.ts`. |
| 4, Gemini fallbacks | **Fixed.** The fallback chain itself works. The real upstream error was never stored (62 warnings with no cause), and `ProviderFallbackLog` had no writer, so the admin fallback page was always empty. Each failure is now logged with its upstream error, credentials removed. Tests: `lib/ai/fallbackReason.test.ts`, updated `router.test.ts`. |

## Part D, done in this batch

| Issue | Result |
|---|---|
| 42, first letter lost | **Fixed.** The chat composer was reset when the chat settings finished loading, wiping what the user had already typed. It now resets only on navigation. Spec: `tests/chat-composer.spec.ts`. |
| 33, music gate | **Fixed.** The lock notice already linked to packages; it now names the published packages that include the tool. Test: `lib/growth/planAccess.test.ts`. |
| 43, home figures | **Server data was correct** (the Super Admin had 130 credits of usage logged on 9 Nov). The card showed 0 while data was missing; it now shows a dash, and the referral line promises a rate only when it is positive. |
| 45, timezone | **Fixed (default).** Both voice-agent forms default to the visitor's time zone. Spec: `tests/timezone.spec.ts`. **Not done:** Live's slow first paint. |

## Part D, batch 2

| Issue | Result |
|---|---|
| 34, stale CRM lists | **Not reproduced in the current code.** Creating a contact, property or automation rule reloads its list with `cache: "no-store"`; the audit predates this code. |
| 35, pulse count | **Fixed.** A failed or pending request counted as "no deals", so the workspace pulse flickered 0/1. It now waits for every request, says so while reading, and refreshes after each CRM change. |
| 41, deal needs a contact | **Fixed.** The new-deal dialog creates a contact inline and selects it; with no contacts it opens that form directly. |
| 38, raw keys | **Fixed.** Saved meetings store agent names, not `ceo, sales` (test: `lib/meeting/agentLabels.test.ts`). The video factory estimate names its three unlabelled lines. Assignment and thesis assistant modes and sales-assistant note categories are labelled. Same-named voice projects show when each was last edited. |
| 44, small defects | **Partly.** Generated websites get the current year for the copyright line; this is a prompt change, so no test can show it without a model call. The automation rule text already has its spaces in the current code. **Not done:** the truncated automation description, the "10.2" figure, the music tile images and the delayed "New project" click. |
| 32, video price | **Not reproduced.** No card reading «ویدیوساز ۲۰» exists in either repository; the video factory already shows the itemized estimate before approval. Needs a screenshot of the card. |
| 36, small-screen navigation | **Not reproduced from code.** Module pages read the view reactively from the address, and at 767 px and below the drawer sits above its overlay. Needs a browser check at about 761 px. |

**Batch 2 verification:** typecheck is clean in both repositories. The full backend suite gave 1,591 passed and 3 failed while it ran in parallel with the UI build; those 3 integration tests pass when run alone (39 tests), so they were contention on the shared test database. The UI production build succeeds; 110 of 111 UI specs pass. The failing `admin-navigation.spec.ts` (duplicate admin links) also fails on the live base `a316d2b`, and this branch does not touch admin navigation.

## Not started
Issue 46 needs a real chat turn on a quiet account (a paid provider call). Roadmap E1-E15.

## Owner actions found
- Instagram events stopped reaching production on 2026-10-05; check and re-enable them (Issue 11).
- The Live campaign needs a «لایو» Comment-to-DM campaign on the admin account where AIFekr's Instagram is connected (Issues 1, 6).
- Server disk was about 3.0 GB free at the start; the release session reports about 3.8 GB after pruning.
