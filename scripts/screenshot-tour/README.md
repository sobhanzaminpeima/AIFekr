# AIfekr screenshot tour

Read-only Playwright script that logs into aifekr.com and screenshots every
page in `pages.json` (plus a best-effort pass over each page's internal
tabs), for use as raw material in a promo video. Never creates, edits, or
deletes any data — navigation and screenshots only.

Standalone from the main app on purpose (its own `package.json`) so
Playwright's Chromium download doesn't become part of every `npm install` on
this project.

## Setup (one-time)

```bash
cd scripts/screenshot-tour
npm install
npx playwright install chromium
```

## Run

```bash
AIFEKR_EMAIL="you@example.com" AIFEKR_PASSWORD="your-password" node run.js
```

Optional: `AIFEKR_BASE_URL` to point at a different environment (defaults to
`https://aifekr.com`).

Credentials are read from these two env vars only — never hardcode them here,
and they are never written into `manifest.json`, `summary.md`, or
`errors.log` (a `redact()` pass strips them from any error text before it's
logged, in case a page ever echoes back what was submitted).

## Output

Everything lands in `aifekr-screenshots/` (gitignored):

- One subfolder per page, per `pages.json`'s `folder` field.
- `manifest.json` — one entry per screenshot, `description` left blank for
  you to fill in later for the video script.
- `summary.md` — a per-page table of screenshots taken / errors, plus any
  pages flagged for manual review (the heuristic looks for what could be a
  real email or phone number left over from earlier testing, so you know to
  check that folder before it goes into a promo video — it never touches or
  masks the data itself, per the read-only rule).
- `errors.log` — one line per page that failed to load, in the form
  `[folder] [url] [message] [timestamp]`. A failure never stops the run; the
  script moves on to the next page.
- `aifekr-screenshots.zip` — the whole folder, zipped, for easy download.

Re-running overwrites the same filenames in place — it does not accumulate
duplicate, differently-named copies from a previous run.

## Adding a page

Edit `pages.json` — no code changes needed. Each entry:

```json
{ "folder": "20-new-page", "title": "عنوان فارسی", "path": "/new-page" }
```

Add `"fullPage": false` for a page that should be captured as just the
visible viewport instead of the full scrollable page (used for `/chat`,
which is an endless-scroll page where "full page" isn't a meaningful shot).
Add `"skipSubTabs": true` to skip the internal-tab detection pass for a page
where it isn't useful.

## Internal-tab detection — how it works, and its limits

Real ARIA tabs (`role="tab"` inside `role="tablist"`) are detected directly.
Most of this app's own tab bars are plain buttons rather than ARIA tabs, so
there's a fallback heuristic: buttons inside `<main>` with short text (under
~24 characters) that sit within the same ~12px vertical band as each other —
i.e., a horizontal row of buttons near the top of the page. This is a
best-effort heuristic, not a guarantee: a page with an unusual layout might
get zero sub-tab shots (falls back to a single "dashboard" screenshot) or, in
principle, pick up an unrelated row of buttons. Check `manifest.json`'s
`sub_view` field against the real page if a folder's screenshot count looks
off, and add `"skipSubTabs": true` for that page if the heuristic is wrong
for it.
