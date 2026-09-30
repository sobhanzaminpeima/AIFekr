# Social Media module — current state (Phase A0)

**Date:** 11 September 2026
**Method:** read of the running codebase + live probes against production (`194.59.171.82` / aifekr.com) with a real session and the real connected account `@aifekrofficial`. No guesses — every "works / doesn't work" line below has a probe behind it.

---

## 0. Which codebase is active — answered, not assumed

`.claude/PROJECT_CONTEXT.md` (the repo's context file; the master prompt's `context/project-context.md` path does not exist) plus the live deploy both confirm:

| | |
|---|---|
| **Active codebase** | **AIFekr legacy** — Next.js **14.2** App Router, **Prisma + SQLite**, single VPS `194.59.171.82`, PM2 (fork, `ai-platform`) + nginx |
| **Not used here** | Next 15 / FastAPI / Supabase monorepo — that is **JARVIS**, a *separate repo* (`C:\Claude Projects\AI Chat\jarvis`) with **no shared backend**; only a stateless JWT SSO bridge connects them |
| **Where Social lives** | 100% in the AIFekr repo. JARVIS has no social module. |

---

## 1. Architecture map

### UI
- `src/app/(dashboard)/(business)/social/page.tsx` — **2,027 lines**, single page, all tabs (create wizard, schedule queue, analytics, comment→DM campaigns). Gated by `BusinessGate` (requires an industry pack or the "continue without pack" cookie).

### Library
- `src/lib/instagram.ts` — **451 lines**. Meta Graph wrapper ("Instagram API **with Instagram Login**", not the older Facebook-Pages flow). All outbound calls route through `AI_RELAY_BASE_URL` because this VPS's IP is network-blocked by Meta.

### API routes (18)
| Route | Purpose |
|---|---|
| `instagram/connect`, `instagram/callback` | OAuth connect |
| `instagram/status` | connection status; `DELETE` = disconnect |
| `instagram/generate` | AI caption + hashtags + best-time |
| `instagram/generate-calendar` | 7-day content calendar |
| `instagram/analyze-image` | vision analysis of a reference image |
| `instagram/publish` | publish image / reel now |
| `instagram/schedule`, `schedule/[id]` | schedule queue CRUD |
| `instagram/analytics` | followers, media count, trend, recent media, **type breakdown** |
| `instagram/analytics/report` | AI growth report |
| `instagram/campaigns`, `campaigns/[id]`, `campaigns/[id]/logs`, `campaigns/link` | comment→DM campaigns + click tracking |
| `instagram/media-proxy` | streams Meta CDN images via a CONNECT tunnel |
| `social/generate`, `social/content-ideas` | generic social copy; industry content ideas |

### Webhook & crons
- `src/app/api/webhooks/instagram/route.ts` — `comments` + `messaging_postbacks`; HMAC-verified; handles keyword match → private reply / follow-gate button.
- Cron `instagram-publish` — every 5 min, publishes due `mode:"auto"` posts.
- Cron `instagram-analytics-snapshot` — **every 6h** (changed today from daily), one follower/media snapshot per run.

### Prisma models (5)
`InstagramConnection` · `InstagramFollowerSnapshot` · `InstagramCommentCampaign` · `InstagramCommentReplyLog` · `ScheduledPost`

### External dependencies
- **Meta Graph API** via relay `69.12.83.245:8081` (nginx path-prefix proxy; `/instagram-api`, `/instagram-graph`, `/facebook-graph`).
- **tinyproxy CONNECT tunnel** `69.12.83.245:8888` for CDN images (`INSTAGRAM_MEDIA_PROXY_URL`).
- **AI:** `routedStreamChat` (`src/lib/ai/router.ts`) for copy; image/video generation providers for media.

---

## 2. What the module actually does today (verified)

- Connect one Instagram Business/Creator account per AIFekr user.
- Generate caption + 5 hashtags + suggested posting time; 7-day calendar; analyze a reference image; "recreate" a post; generate post image / reel video.
- Schedule posts — `manual` (copy it yourself) or `auto` (cron publishes).
- Analytics: live follower & post count, follower trend line, recent media with **per-post views / reach / saves / shares**, **breakdown by content type (Reels vs Photo vs Carousel)**, and an AI growth report.
- Comment→DM campaigns: multi-keyword match (Latin + Persian comma), optional per-post targeting, `{username}` token, optional public reply, up to 2 click-tracked links, optional **Follow Gate**, 750/hr cap, idempotent on `commentId`, full log per comment.

### Live probe results (production, `@aifekrofficial`, today)
```
followers 12,093 · media 14 · mediaError: null
mediaBreakdown: REELS 3 (1,242 views, avg 414) · IMAGE 7 (586 views, avg 84) · CAROUSEL 2 (678 views, avg 339)
media-proxy on a real signed URL → 200 image/jpeg, 319 KB
/api/ai/chat-providers → 20+ providers returned
```

---

## 3. Tenant-data linkage — the central finding

**The Social module is almost entirely blind to the rest of AIFekr.**

| Data the platform already holds | Does Social use it? |
|---|---|
| `Company` (name, industry, website, size, revenue, notes, logo) — collected by **Business Doctor** | ❌ only `/api/social/content-ideas` reads it. `generate`, `generate-calendar`, `analyze-image` do **not**. |
| `CrmPipeline.industrySlug` / `IndustryPack` | ❌ same — only `content-ideas`. |
| `BusinessAnalysis` (Business Doctor's full SWOT/analysis result) | ❌ never read by Social. |
| `BusinessMemory` — **already has a `"social"` category** with embeddings, written/read by CEO Orchestrator and the SEO pipeline | ❌ Social never reads or writes it. |

Instead, `businessName` / `businessType` are **free-form form fields that start empty on every visit** (`form.brandName: ""`, `src/.../social/page.tsx:80`) and are POSTed as strings. Nothing about brand tone, target audience, page positioning, or competitive stance is ever persisted.

**Consequence:** a doctor cannot "describe their page and positioning once" — they retype a brand name every session, and the AI has no memory of who they are.

---

## 4. "Is / isn't" table against the master prompt's goal

| Capability the prompt asks for | Status |
|---|---|
| Business owner describes page type / specialty / audience / tone / positioning | ❌ **absent** — no storage, no UI |
| Social reads the Business Doctor profile | ⚠️ **partial** — only the content-ideas endpoint |
| Find similar/competitor pages & extract their high-engagement posts | ❌ **completely absent** — no model, route, or UI |
| Explain *why* a competitor post worked (hook/format/timing) | ❌ absent |
| Suggest brand-specific content derived from that analysis | ⚠️ generates content, but from a one-off form, not from competitor data or a stored profile |
| Follower growth over time | ✅ exists (6h snapshots) |
| Weekly / monthly bucketing | ❌ absent — raw point list only |
| Growth rate vs engagement rate (real vs inactive followers) | ❌ absent |
| Correlate content type ↔ follower movement | ⚠️ type breakdown exists; **no correlation with follower change** |
| Automatic insight/alert on slowdown or decline | ❌ absent |
| Flag when real Insights data is unavailable | ✅ `mediaError` surfaces; trend has an explicit "collecting" state |
| Content-quality scoring & corrective feedback (hook, length, format fit, brand fit) | ❌ absent — generates, never grades |
| Monitoring/alert when comment→DM goes silent | ❌ **absent** — this is exactly why today's month-long outage went unnoticed |
| Per-tenant isolation | ✅ every query is `userId`-scoped (SQLite + app-level scoping; no RLS layer in this stack) |

---

## 5. Status of the two previously-reported bugs

| Bug | Finding |
|---|---|
| "Social Media doesn't load the connected account's post images" | **Fixed today.** Root cause: the relay box's tinyproxy (`:8888`) allow-list still held the *old* server IP `185.81.99.80`; production `194.59.171.82` was denied (`403 Access denied`). Added `Allow 194.59.171.82` + restarted. Verified: real signed URL → `200 image/jpeg, 319 KB`. (A `502` appears only for a *truncated* URL — Meta returns `Bad URL hash` — which is correct behaviour, not a bug.) |
| "AI model picker not shown in Social" | **Appears resolved.** The `<select>` exists in two places with an explicit `auto` option, gated on `chatProviders.length > 0`; the endpoint returns 20+ providers on production. Needs one visual confirmation in the UI before being closed. |

---

## 6. Note on Phase B (comment→DM) — root cause already found today

Not part of A0, recorded here so it isn't re-investigated: the reason Sobhan's `aifekr` comment produced no DM was diagnosed and fixed earlier today. Three stacked faults: (1) the relay was down for ~1 month, (2) `InstagramConnection.igUserId` stored the OAuth `user_id` (`279…790`) instead of the real IG User ID (`17841408031394212`), so **every inbound webhook failed its connection lookup**, (3) the account was not subscribed to the `comments` webhook field. All three fixed and verified. Full write-up belongs in Phase B0.

---

## Executive summary

1. Active codebase is confirmed **AIFekr legacy (Next 14.2 / Prisma / SQLite)**; Social lives entirely there — JARVIS is unrelated.
2. The module is a solid **publishing + campaign tool**: OAuth, AI copy, calendar, scheduling, auto-publish, comment→DM with follow-gate and click-tracking, and (as of today) real per-post views/reach and a Reels-vs-Posts breakdown.
3. It is **not yet a growth engine**: it is disconnected from the tenant's own business data — brand name is retyped from an empty form every session, and Business Doctor / BusinessMemory / industry pack are effectively unused.
4. **Three capabilities are completely absent**: competitor/similar-page analysis, content-quality scoring, and any alert when a feature (like comment→DM) silently stops working.
5. Both previously-reported bugs are resolved — images were the relay allow-list (fixed and verified today); the model picker looks correct in code and needs one UI eyeball.

**Awaiting your approval to proceed to Phase A1 (gap analysis).**
