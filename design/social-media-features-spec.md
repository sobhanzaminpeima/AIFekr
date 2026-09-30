# Social Media — feature spec (Phase A2)

**Date:** 11 September 2026
**Scope approved by Sobhan:** all five items from `analysis/social-media-gap-analysis.md`, plus adding `instagram_basic` (Advanced Access) to the existing Meta App Review submission.
**Stack:** AIFekr legacy — Next 14.2 App Router, Prisma + SQLite, single VPS. No Supabase/RLS in this codebase; tenant isolation is app-level `userId` scoping, consistent with every other module here.

---

## Schema changes (one migration, all five features)

```prisma
model SocialBrandProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  pageType       String?
  specialty      String?
  audience       String?
  tone           String?
  /// JSON array of 3–5 content pillars
  contentPillars String?
  /// Hard "never post this" list — also fed by rejected competitor suggestions
  avoidTopics    String?
  positioning    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SocialCompetitor {
  id        String   @id @default(cuid())
  userId    String
  username  String
  label     String?
  /// "manual" | "suggested"
  source    String   @default("manual")
  isActive  Boolean  @default(true)
  lastError String?
  createdAt DateTime @default(now())
  snapshots SocialCompetitorSnapshot[]
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, username])
  @@index([userId])
}

model SocialCompetitorSnapshot {
  id             String   @id @default(cuid())
  competitorId   String
  takenAt        DateTime @default(now())
  followersCount Int
  mediaCount     Int
  /// JSON array of posts at capture time
  topPosts       String
  competitor SocialCompetitor @relation(fields: [competitorId], references: [id], onDelete: Cascade)
  @@index([competitorId, takenAt])
}
```

Plus two nullable columns on the existing `ScheduledPost` for the quality feedback loop:
`qualityScore Int?` · `qualityNotes String?` (JSON array of the fixes suggested at generation time).

All additive. No column is dropped or retyped, so the migration is safe to push — **but per project rules it still gets an explicit confirmation and a `prod.db` backup before it runs.**

---

## Feature 1 — Brand & positioning profile

**Why:** the module currently asks a doctor to retype their brand name into an empty field every session while the platform already stores their target customers, competitors and unique value in `Company.notes`.

- **`GET /api/social/brand-profile`** — returns the saved row; if none exists, returns a **draft pre-filled** from `Company` (name, industry) + `Company.notes` JSON (`description`, `targetCustomers`, `uniqueValue`, `competitors`) and flags `isDraft: true`.
- **`POST /api/social/brand-profile`** — upsert. On success also upserts a `BusinessMemory` row with `category: "social"` so the CEO Orchestrator and SEO pipeline inherit the positioning.
- **UI:** a collapsible "برند و موضع پیج" card at the top of `/social`, pre-filled, three languages. Once saved, the create-wizard's brand fields are prefilled and no longer block generation.
- **Wiring:** `instagram/generate`, `generate-calendar`, `analyze-image` and `analytics/report` read the profile **server-side** from the session user — the client no longer dictates who the business is.
- **AI:** existing `routedStreamChat`. No new service, no new cost beyond slightly longer prompts.

## Feature 2 — Silent-failure monitoring

**Why:** comment→DM was dead for ~4 weeks and nothing in the product said so.

- New cron route `GET /api/cron/social-health?secret=…`, registered hourly.
- Checks per tenant with an Instagram connection:
  - `campaign_silent` — an active campaign exists **and** comment webhooks were received in the window **and** zero `sent` logs in 3 days.
  - `queue_stuck` — `ScheduledPost` rows `PENDING` more than 30 min past `scheduledFor`.
  - `snapshot_stale` — no `InstagramFollowerSnapshot` in >24h (token expired / relay down).
  - `token_expiring` — `InstagramConnection.tokenExpiry` within 7 days.
- Alerts via the existing `notify()` choke point, to the tenant **and** to admins, deduped so the same condition does not re-notify daily.
- Counting inbound comments requires knowing a comment arrived even when no campaign matched → the webhook gains a lightweight `InstagramCommentReplyLog` row with `status:"no_match"` (already-existing table, no schema change).

## Feature 3 — Analytics analysis layer

All computed in `src/lib/social/analytics.ts`, returned by the existing `/api/social/instagram/analytics`. **No new table.**

- `buckets.weekly[] / buckets.monthly[]` — first/last follower count per bucket + delta.
- `growthRate` — % vs previous equal window.
- `engagementRate` — (likes+comments+saves+shares) ÷ reach, and ÷ followers.
- `audienceQuality` — avg reach ÷ followers. This account sits near 0.5%, which must be *named*, not hidden behind a flat chart.
- `correlations[]` — follower delta per window joined to the posts published in it, ranked by type.
- `insights[]` — **deterministic rules**, each carrying the numbers it was derived from: `growth_slowdown`, `growth_decline`, `low_audience_quality`, `reels_outperform_static`, `no_posts_in_window`, `engagement_collapse`.
- `dataConfidence: "ok" | "insufficient"` — set when <2 snapshots or `mediaError`; the UI must render the honest state instead of a confident-looking analysis, and the AI report is told the same.

## Feature 4 — Competitor analysis (official API, feature-flagged)

**Legal basis:** Meta's `business_discovery` edge, called on our IG Business Account node with the **Page token** (`facebook-graph` path). No scraping — the never-build list is respected.

**Verified today:** the Page↔IG link exists; own-account reads succeed; only cross-account reads return `(#10) Application does not have permission` → needs `instagram_basic` **Advanced Access**, now approved by Sobhan to add to the App Review submission.

- `src/lib/social/competitors.ts` — `discoverCompetitor(username)` via `business_discovery`, returning followers/media/top posts.
- `GET/POST/DELETE /api/social/competitors` · `POST /api/social/competitors/[id]/refresh` · `POST /api/social/competitors/analyze`.
- Cron: competitor snapshots folded into the existing 6h analytics cron, capped per tenant.
- **Feature flag** `SOCIAL_COMPETITORS_ENABLED` — ships dark; when App Review lands, flip the env var. Until then the UI shows an honest "در انتظار تأیید متا" state rather than a broken button.
- **Interim manual mode** (also approved): the owner pastes a competitor post's permalink/caption + visible metrics, or uploads a screenshot, and the existing vision route explains why it worked. Works today, no App Review needed.
- **Owner-approval step (required):** every generated suggestion is a **draft** with a "این به برند من نمی‌خورد" reject button; the rejection reason is appended to `SocialBrandProfile.avoidTopics`. Nothing reaches the publishing queue without approval.
- **Isolation:** all routes `userId`-scoped; a tenant can only read their own competitors and snapshots.
- **Rate/cost:** 1 Graph call per competitor per refresh; 1 `routedStreamChat` call per analysis (not per post). Capped at 5 active competitors per tenant.

## Feature 5 — Content quality scoring

`src/lib/social/contentQuality.ts` — deterministic first, AI second.

- Rule score 0–100: hook within the first ~125 chars, caption length band per format, CTA presence, hashtag count/specificity, emoji balance, ALL-CAPS/spam signals, format fit.
- Optional AI layer: brand fit against `SocialBrandProfile` (tone, pillars, `avoidTopics`) → short reason + concrete rewrite.
- UI: score chip + up to 3 specific fixes in the wizard before scheduling. **Advisory, never blocking.**
- Feedback loop: score stored on `ScheduledPost.qualityScore`; after ≥72h live, compared against actual reach/engagement so the rules can be tuned against this account's own history.

---

## Implementation order (separate commits)

1. Schema migration (all tables/columns at once) — **confirmation + `prod.db` backup first**
2. `SocialBrandProfile` — API, prefill, UI, prompt wiring
3. Analytics analysis layer + UI surfacing
4. Silent-failure monitoring cron + notifications
5. Content quality scoring + wizard UI
6. Competitor analysis behind the flag + manual interim mode

## Non-goals for this phase
Auto-suggesting competitors from industry/city; publishing social insights into the CEO weekly brief; anything requiring a new external paid service.
