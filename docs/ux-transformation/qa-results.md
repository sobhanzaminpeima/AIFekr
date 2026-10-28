# QA Results — 2026-10-28

## Automated
| Check | Result |
|---|---|
| `tsc --noEmit` | Pass |
| ESLint on changed files | 0 errors; 5 warnings, all pre-existing (same count on the original files) |
| `src/lib/navigation/workspaces.test.ts` | 6/6 — registry only uses real routes; objectives map to workspaces; student workspace has no CRM/accounting/sales/lead-gen; goal search fa/en ("make a Reel", "quiz from my PDF", "connect Instagram", "manage customers", "workout plan", "AI voice", Arabic ي/ك variants) |
| Full suite | 1,276 passed, 87 skipped, 2 failed — the pre-existing `fitness/adminAccess.integration.test.ts` failures (also fail without these changes) |

The search tests caught two real ranking bugs before release ("workout plan" → study planner; "quiz from notes" tie with upload); fixed with whole-word scoring.

## Manual (local preview, test account, port 3073)
| Scenario | Result |
|---|---|
| Signed-out `/home` | `/login?redirect=%2Fhome` |
| Existing user, no workspace | Classic menu unchanged + switcher; home shows the 6-card picker above the usual content |
| Choose "Creator" | Saved (`active: creator`); sidebar shows Create / Publish / Library; classic business menu hidden behind "All tools"; business command centre hidden on home; home shows "Create your first image" + quick actions |
| "All tools" | Full classic menu appears (e.g. Startup builder) |
| Goal search | "میخوام ریلز بسازم" → Social, Video Factory · "اتصال اینستاگرام" → Social · "آزمون از جزوه" → practice quiz · "AI voice" → Voice Studio |
| Mobile 375px | Workspace home renders in one column, no horizontal scroll |
| Bug found and fixed | Importing `CommandPalette` into the home page left `/home` stuck on the loading screen in dev; replaced with the event name |

## Not tested
- Real-estate, business, student and fitness workspaces in the browser (covered by registry tests only).
- Screen-reader pass (switcher uses listbox/option roles and focus outlines; not verified with a reader).
- Production: not deployed (needs approval).
