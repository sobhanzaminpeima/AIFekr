# Social Media — gap analysis (Phase A1)

**Date:** 11 September 2026
**Baseline:** `analysis/social-media-current-state.md` (Phase A0)
**Method:** code reading + **live API probes against production** with the real connected account. Every "possible / not possible" claim below has a probe behind it, quoted verbatim.

---

## 1. Connection to the business profile / Business Doctor

**Status: ⚠️ INCOMPLETE — and much cheaper to fix than expected.**

### What already exists (and Social ignores)

`POST /api/business-profile` stores the Business Doctor questionnaire into `Company`. The columns hold the basics; **everything else is JSON-packed into `Company.notes`**:

```ts
const { name, industry, website, phone, email, address, size, revenue, ...extra } = body;
const notes = JSON.stringify(extra);   // src/app/api/business-profile/route.ts:72
```

`extra` — already collected from the business owner today — contains:

> `description`, `products`, **`targetCustomers`**, **`competitors`**, `goals`, `challenges`, `strengths`, `businessModel`, **`uniqueValue`**, `foundedYear`

Plus `BusinessAnalysis.result` — the full Business Doctor SWOT/analysis text — and `BusinessMemory` with an existing **`"social"` category** (embeddings, already used by CEO Orchestrator and the SEO pipeline).

**So a doctor has *already* told AIFekr their target customers, their competitors and their unique value — and the Social module never reads a word of it.** It asks them to retype a brand name into an empty field instead (`form.brandName: ""`).

### What is genuinely missing

Nothing in the platform captures **social-specific positioning**: page type/specialty, brand tone of voice, content pillars, what the page must *never* post, and who the audience is *on Instagram specifically* (which differs from the CRM's customer profile).

### Proposal (concrete)

**New model** (Prisma/SQLite, per existing legacy pattern — one row per tenant):

```prisma
model SocialBrandProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  pageType        String?   // "clinic" | "real-estate" | "restaurant" | free text
  specialty       String?   // "orthodontics", "luxury apartments", …
  audience        String?   // who they want to reach on Instagram
  tone            String?   // "professional & warm", "bold", …
  contentPillars  String?   // JSON array of 3–5 themes
  avoidTopics     String?   // hard "never post this" list
  positioning     String?   // one-paragraph competitive stance
  language        String   @default("fa")
  updatedAt       DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- **API:** `GET/POST /api/social/brand-profile`. On first `GET`, if no row exists, **seed the draft from `Company` + `Company.notes` + `BusinessAnalysis`** so the owner edits a pre-filled form instead of starting blank.
- **UI:** a "برند و موضع پیج" panel at the top of `/social`, collapsed once complete; the wizard's `brandName`/`platform` fields become **prefilled and optional** rather than required-every-time.
- **Wiring:** `generate`, `generate-calendar`, `analyze-image`, `analytics/report` all take the profile server-side (not from the client) and inject it into the prompt.
- **AI service:** none new — the existing `routedStreamChat`.
- **Also:** on save, upsert a `BusinessMemory` row with `category:"social"` so the CEO Orchestrator and SEO pipeline inherit the positioning.

**Cost/risk:** low. One table, one form, prompt changes. No external API.

---

## 2. Competitor & viral-content analysis

**Status: ❌ COMPLETELY ABSENT — but a fully legal, official API path exists and I verified it today.**

### Scraping is off the table
`.claude/PROJECT_CONTEXT.md` "Never build" list explicitly rejects Instagram scraping/downloading as a ToS violation. Not proposing it.

### The official path — probed live today

Meta's **`business_discovery`** edge returns, for *any public Business/Creator account*, by username: follower count, media count, and recent media with **caption, like_count, comments_count, media_product_type, timestamp, permalink**. That is precisely what this phase asks for, from Meta's own API.

Probe 1 — the required Page ↔ Instagram link **already exists** on our app:
```
GET /{page}?fields=instagram_business_account
→ {"instagram_business_account":{"id":"17841408031394212"},"name":"AIFekr"}
```

Probe 2 — reading **our own** account through that Page token works (so `instagram_basic` is granted and the plumbing is correct):
```
GET /17841408031394212?fields=username,followers_count,media_count
→ {"username":"aifekrofficial","followers_count":12093,"media_count":14}
```

Probe 3 — reading **another** account is the only thing that fails, and it fails on *app permission*, not on tokens or wiring:
```
GET /17841408031394212?fields=business_discovery.username(natgeo){followers_count,media_count}
→ (#10) Application does not have permission for this action
```

Probe 4 — `business_discovery` does **not** exist at all on the newer "Instagram API with Instagram Login" flow the Social module currently uses:
```
→ IGApiException: Tried accessing nonexisting field (business_discovery)
```

### Conclusion

Competitor analysis is **buildable, official and ToS-clean**, and blocked by exactly one thing: **App Review for `instagram_basic` Advanced Access**, called through the **Page-token (facebook-graph) path**, not the IG-login path.

> **This is a decision for you.** It is the same App Review you are already doing for `leads_retrieval`; `instagram_basic` can be added to the same submission. Until it is approved, `business_discovery` returns `#10` for every competitor.

### Proposal (concrete)

**Models:**
```prisma
model SocialCompetitor {
  id         String   @id @default(cuid())
  userId     String
  username   String              // instagram handle, no @
  label      String?             // "کلینیک رقیب در سعادت‌آباد"
  source     String   @default("manual")  // "manual" | "suggested"
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  snapshots  SocialCompetitorSnapshot[]
  @@unique([userId, username])
  @@index([userId])
}

model SocialCompetitorSnapshot {
  id             String   @id @default(cuid())
  competitorId   String
  takenAt        DateTime @default(now())
  followersCount Int
  mediaCount     Int
  /// JSON array of the top posts at capture time (caption, likes, comments, type, timestamp, permalink)
  topPosts       String
  competitor SocialCompetitor @relation(fields: [competitorId], references: [id], onDelete: Cascade)
  @@index([competitorId, takenAt])
}
```

**Routes:** `GET/POST/DELETE /api/social/competitors` · `POST /api/social/competitors/[id]/refresh` · `POST /api/social/competitors/analyze`.

**Cron:** reuse the existing 6h `instagram-analytics-snapshot` slot (or a separate 12h one) to snapshot each active competitor — rate-limited, max N per tenant.

**What the user sees:** for each competitor, their top posts (thumbnail via the existing `media-proxy`, caption, likes/comments, format), then an AI read of **why each worked** (hook, format, length, posting time, content type), then **a suggestion written for *their* brand** — derived from the pattern, never a copy of the competitor's text.

**Owner-approval step (required by the master prompt):** the suggestion is generated as a **draft with an explicit "این به برند من نمی‌خورد" reject button**; rejecting records the reason into `SocialBrandProfile.avoidTopics` so the next suggestion is better. Nothing is generated into the publishing queue without that approval.

**Per-tenant isolation:** every query `userId`-scoped, same as the rest of this stack (SQLite + app-level scoping; there is no RLS layer in the legacy codebase — that is a Supabase concept and does not apply here). One tenant's competitor set and analysis is never readable by another.

**Interim option while App Review is pending (your call):** a "paste a post" mode — the owner pastes a competitor post's permalink + its visible metrics, or uploads a screenshot, and the existing `analyze-image` vision route explains why it worked. Honest but manual; I would ship it only if you want value before App Review lands.

**Cost:** `business_discovery` calls count against the app's standard Graph rate limit — snapshotting is cheap (1 call per competitor per run). The AI "why it worked" analysis is one `routedStreamChat` call per refresh, not per post.

---

## 3. Follower & real-growth analytics

**Status: ⚠️ INCOMPLETE — the foundation landed today; the *analysis* layer is missing.**

| Requirement | Status |
|---|---|
| Follower trend over time | ✅ 6h snapshots, chart live |
| Weekly / monthly bucketing | ❌ raw point list only |
| Growth rate vs **engagement** rate (real vs inactive followers) | ❌ absent |
| Content type ↔ follower jump/drop correlation | ⚠️ type breakdown exists, never joined to follower movement |
| Automatic insight/alert on slowdown or decline | ❌ absent |
| Flag when real Insights data is unavailable | ✅ `mediaError` + explicit "collecting" state |

This matters concretely for this very account: `analysis/instagram-audit.md` measured **12,095 followers but only 592 views / 66 interactions in 30 days (~0.5% monthly reach)** — the single most important number about this page, and the product currently cannot compute or surface it.

### Proposal (concrete)

Extend `/api/social/instagram/analytics` (no new table — all derivable from `InstagramFollowerSnapshot` + `getRecentMedia`):

- `buckets: { weekly[], monthly[] }` — first/last snapshot per bucket + delta.
- `growthRate` — % change vs the previous equal-length window.
- `engagementRate` — (likes + comments + saves + shares) ÷ reach, and ÷ followers, per post and averaged.
- `audienceQuality` — followers ÷ avg reach. A ratio like this account's (~0.5%) triggers an explicit "inactive/low-quality follower base" finding rather than a silent flat chart.
- `correlations[]` — for each follower-delta window, which posts went out in it and of what type; ranks types by follower gain per post.
- `insights[]` — **rule-based and deterministic** (not AI): e.g. `growth_slowdown` when the 2-week rate is ≥25% below the 8-week average, `reach_collapse`, `reels_outperform_static`, `no_posts_in_window`. Each carries a plain-language Persian/English/German string and the numbers it was computed from.

The existing AI report then *narrates* these computed facts instead of eyeballing raw numbers — which also removes the current risk of the model inventing trends.

**Honesty requirement kept:** when fewer than 2 snapshots exist, or `mediaError` is set, the response flags `dataConfidence: "insufficient"` and the UI must say so rather than render a confident-looking analysis. (Today's chart already has the "collecting" state; this extends the same rule to every derived metric.)

---

## 4. Content quality

**Status: ❌ ABSENT.** The module generates captions and never grades them. There is no feedback loop, no score, no "this hook is weak" — the owner has no way to tell a good generation from a bad one before it is scheduled.

### Proposal (concrete)

New pure-function module `src/lib/social/contentQuality.ts` — deterministic first, AI second:

**Rule-based score (0–100), no API cost:**
- Hook strength — does something concrete/curious land in the first ~125 characters (the cut-off before "more")?
- Caption length band per format (Reel vs carousel vs single image).
- CTA present — question, "save this", link prompt.
- Hashtag count & specificity (5 broad tags ≠ 5 niche tags).
- Emoji balance; ALL-CAPS / spam signals.
- Format fit — e.g. "this is a list of 5 items posted as a single image; a carousel performs better".

**AI layer (one call, optional):** brand fit against `SocialBrandProfile` (tone, pillars, `avoidTopics`) → a short "why" plus a concrete rewrite suggestion.

**UI:** a score chip + up to 3 specific fixes shown in wizard step 3, before scheduling. Owner can ignore it — it advises, never blocks.

**Feedback loop:** after a post has been live ≥72h, compare its predicted score against actual reach/engagement and store the pair, so the rules can be tuned against this account's own data rather than generic advice.

---

## 5. Silent-failure monitoring

**Status: ❌ ABSENT — and this is the gap that cost a month.**

Comment→DM was broken for ~4 weeks. Nobody knew until Sobhan hand-tested it. Nothing anywhere in the product says "this feature has produced zero results while receiving input".

### Proposal (concrete)

- **Health signal per feature**, computed in a cron: an active campaign + inbound comment webhooks received + **0 DMs sent in N days** ⇒ unhealthy.
- Use the existing `notify()` choke point (`src/lib/notifications/create.ts`) to alert **both** the tenant and admins, with a link to the campaign.
- Surface on the campaign card: *last triggered*, *DMs sent in last 7 days*, and a red state when unhealthy. (UI detail belongs to Phase B2; the detection belongs here.)
- Same pattern for the publish queue (posts stuck `PENDING` past their time) and the analytics snapshot (no snapshot in >24h ⇒ token expired or relay down).

---

## Prioritised recommendation

### Must — highest impact per unit of work
1. **`SocialBrandProfile` + prefill from Business Doctor + inject into every prompt.** Turns the module from generic to tenant-aware. One table, no external dependency. *This is the single change that most directly serves "a doctor explains their page and gets content for their page".*
2. **Silent-failure monitoring.** Cheap, and it is the reason a month was lost.
3. **Analytics analysis layer** (buckets, engagement rate, audience quality, correlations, rule-based insights). No new table; makes the existing chart mean something — and immediately surfaces this account's real 0.5%-reach problem.

### Should — high value, gated on a decision
4. **Competitor analysis via `business_discovery`.** Fully designed above and verified reachable; **needs your go-ahead to add `instagram_basic` Advanced Access to the existing App Review submission.** Say the word and I build it behind a feature flag so it lights up the moment approval lands. Optional manual "paste a post" interim mode if you want value sooner.
5. **Content-quality scoring** (rule-based first; AI brand-fit second).

### Next phase
6. Predicted-score vs actual-performance feedback loop (needs a few weeks of posts to be meaningful).
7. Auto-suggesting competitors from the tenant's industry/city instead of manual entry.

---

## Open decisions for you

1. **App Review:** add `instagram_basic` (Advanced Access) to the submission so competitor analysis can work? Without it, item 4 cannot function at all.
2. **Interim manual competitor mode** — build it now, or wait for App Review?
3. Confirm the **Must** list (1–3) as the Phase A2 scope, and whether 4–5 go in the same phase or the next.

**Awaiting your approval before Phase A2 (design + implementation).**

---

### Extra suggestions (out of scope — not building unless you ask)
- The Social module could publish its computed insights into `BusinessMemory(category:"social")`, so the CEO Orchestrator's weekly brief includes social health automatically.
- `analysis/instagram-audit.md` concluded this page's category is "Real Estate" while the bio claims all industries; a `SocialBrandProfile` makes that contradiction visible and fixable in-product rather than in a one-off document.
