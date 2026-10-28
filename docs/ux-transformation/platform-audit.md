# Platform UX Audit — 2026-10-28

## Verified problems (from the code, not assumed)

| # | Problem | Evidence |
|---|---|---|
| 1 | The sidebar shows ~40 destinations from every domain at once | `src/components/layout/Sidebar.tsx`: Home, FIT, Chat, Student, Business Doctor card, 4 business departments (11 items), Agents, Gallery, Video Factory, Voice Studio, PLAY, Startup, SEO Intelligence card, 6 Tools, 7 Assistants, Projects, history |
| 2 | Home is business-only | `src/app/(dashboard)/home/page.tsx` titles it "Command centre — where your business stands"; a creator/student with no CRM data sees "Nothing to report yet — add your first contact or property" |
| 3 | Search only matches names | `src/components/ui/CommandPalette.tsx` filtered by `includes()` on labels; "make a Reel", "quiz from my PDF", "connect Instagram" found nothing |
| 4 | No way to say "I'm a creator / student / fitness user" outside account type | Only `accountType` STUDENT/FITNESS hides business items (`hideBusiness`); personal accounts see everything |
| 5 | Technical labels | e.g. "SEO workflow", "AI team orchestration", "Ledger setup", "Industry packs" compete with plain-language goals |
| 6 | Image/video/music have no sidebar entry (they are chat composer tabs) | Comment in Sidebar.tsx lines 448–451; discoverable only via chat or search |
| 7 | Instagram connection failures were opaque | `/social?instagram=failed` with a generic toast; see Instagram section below |

## Existing assets reused
- `src/lib/navigation/destinations.ts` — 68 real routes with fa/en/de/tr labels (single source for search and workspaces).
- `CommandPalette` (Ctrl K, mobile header) — upgraded instead of replaced.
- `ModuleRegistry` + `/api/modules/status` — admin on/off per module; workspace items respect it (`isAvailable`).
- Smart onboarding objectives (customer growth engine) — mapped to a suggested workspace.
- Growth settings + admin Settings tab — `adaptive_workspaces_enabled` flag (rollback switch).

## Instagram `/social?instagram=failed` (backend, handled separately)
- File: `src/app/api/social/instagram/callback/route.ts`, function `GET`.
- Two redirects: line 35 (pre-checks, no logging) and line 101 (catch).
- Production log (2026-10-28, build `.next-voice-b89eea5`): `Instagram OAuth callback error: Error: Unsupported request - method type: get`, mapped through the source map to `getLongLivedToken()` in `src/lib/instagram.ts` (GET `graph.instagram.com/access_token?grant_type=ig_exchange_token`). The code exchange before it succeeded.
- Earlier failures (older builds): `این حساب اینستاگرام قبلاً به فضای کاری دیگری متصل شده است` (account already linked to another workspace).
- Relay and endpoint paths verified with a fake token (normal OAuth error returned), so routing is correct; the rejection is Meta-side for this account. Meta forum reports the same error for some accounts only; with the Tester status still Pending, the account not having accepted the tester invite while the app is in development mode is the most likely cause — not proven without a live test.
