# Customer follow-up audit (2026-11-05)

Scope: everything in the backend (`sobhanzaminpeima/AIFekr`, branch `claude/saas-growth-20261103`, base `eb048450`) and the new-design UI (`sobhanzaminpeima/AIFekr_UI`, `94e177a`) that touches follow-up, leads, lifecycle, notifications, campaigns and conversion **of AIFekr's own customers**.

Not in scope: the tenant CRM, which holds our users' own customers. Those contacts are never read here; `facts.ts` only reads a per-owner count.

Classification:
- **Full**: implemented and wired.
- **Partial**: works, but lacks something the master prompt asks for.
- **Disconnected**: built, but its output reaches nobody.
- **Defective**: wrong behaviour.
- **Missing**: does not exist.
- **Unused**: exists, but nothing calls it.

## 1. Data and events

| Capability | Status | Where | Notes |
|---|---|---|---|
| Growth event log | Full | `GrowthEvent` table, `src/lib/growth/events.ts` (`trackEvent`) | Idempotent (`idempotencyKey` unique) and never throws into the caller. Metadata is flat and capped: no prompts or content. |
| Client event allow-list | Full | `CLIENT_EVENTS` in `events.ts`, `POST /api/growth/event` | The browser cannot report money, credit or success events. |
| Generation success/failure events | Full | `src/lib/growth/generation.ts` (`recordGenerationSucceeded`), 7 callers | `first_value_achieved` and `first_voice_generated` are recorded server-side. |
| Payment and subscription events | Full (by design, not as events) | `Payment`, `User.plan`/`planExpiry` read by `facts.ts` | No `payment_succeeded` GrowthEvent exists. The engine reads the authoritative Payment rows instead, so a forged or duplicated event can never fake a purchase. |
| Credits | Full | `src/lib/credits/ledger.ts` (`CreditLedgerEntry`, the only ledger), `User.credits`, `UsageLog` | `facts.ts` reads `User.credits` and `UsageLog`. No parallel balance. |
| Free-credit policy | Full, off | `src/lib/credits/freeCredits.ts`, SiteSetting `freeCreditsPolicy` | Waits for super-admin approval. The follow-up engine does not grant credits. |
| Attribution touches | Full | `GrowthTouch`, `POST /api/growth/touch`, `src/lib/growth/attribution.ts` | Only UTM values and the referrer host are kept. Linked to the user at sign-up (`linkSignup`). |
| Attribution touches from the new design | Full | UI `components/growth-tracker.tsx`, mounted in `app/[[...slug]]/page.tsx` | Sends the same beacons as classic. |
| Attribution for signed-out visitors of app pages (`/live`) | Defective | UI `shellData` redirects to sign-in before the tracker runs | The UTM is inside the encoded `next=` value, so the tracker's `utm_` test misses it. A signed-out Instagram visitor to `/live` lost attribution. **Fixed here** with a server-side touch on the tracked-link redirect (see §4). |
| `/live` as a sign-in return path | Defective | `RETURN_PREFIXES` in `attribution.ts`, used by `loginPathFor` (`src/lib/layout/platformShellData.ts`) | `/live` was missing, so a signed-out visitor was sent to a bare `/login`. They lost both the page and the UTM. **Fixed here.** |
| Live as a growth module | Missing | `src/lib/growth/modules.ts` | `/live` mapped to no module, so campaign landings on `/live` had no `targetModule`. **Fixed here.** |
| Live transcripts counted as "chat" first value | Defective (policy) | `facts.ts` chat query joined every `Conversation`, including `tool="live"` | Live transcripts must not feed marketing targeting. **Fixed here:** live conversations are excluded; Live usage is read only from `LiveVoiceSession` metadata (seconds and minutes, no content). |

## 2. Customer intelligence

| Capability | Status | Where | Notes |
|---|---|---|---|
| Lifecycle stages | Full | `src/lib/growth/lifecycle.ts` (`stageFor`) | 9 stages from real evidence. |
| Segments | Full | `segmentsFor`, 11 segments, thresholds in settings | |
| Explainable lead score | Full | `scoreFor`, weights in SiteSetting `growthSettings` | Each rule counts once and every point has its evidence. Live usage was not a signal; it is added here as a separate, admin-tunable weight (`liveUsed`, default 0). |
| Customer 360 | Full | `customerDetail` in `src/lib/growth/analytics.ts`, `/admin/customer-growth/[id]` | Identity, attribution, usage, billing, timeline and notes. No prompts or content. Follow-up jobs are added to the timeline here. |
| Next best action | Full (advisory) | `nextBestAction` | Never executed automatically. |
| Admin follow-up status/notes | Full | `GrowthProfile.followUpStatus`, `GrowthNote`, `POST /api/admin/growth` | |

## 3. Messaging and follow-up

| Capability | Status | Where | Notes |
|---|---|---|---|
| Lifecycle rules (12) | Full | `RULES` in `src/lib/growth/automation.ts` | Guidance vs promotional; promotional rules never target paying users. |
| Templates + variable validation | Full | `validateTemplate`/`renderTemplate`, Admin → Automations | fa/en only. de/tr users got English. **Fixed here:** built-in de/tr texts with an English fallback. |
| Dry-run preview | Partial | `runLifecycle({ dryRun: true })` | Computes counts on the fly but **records nothing**, so there is no history of intended sends. |
| Real send path | Defective | `runLifecycle({ dryRun: false })` → `notify()` inline | No persistent job, no retry: `notify()` swallows errors, so a failed send is logged as `sent`. Eligibility is not re-checked at send time. Quiet hours skip the run instead of rescheduling. Caps are 48 h / 4 per 14 days, while the prompt asks for 1 per 24 h / 3 per 7 days. **Replaced here** by the follow-up job engine; `runLifecycle` is now preview-only. |
| Email for lifecycle messages | Disconnected | `notify({ email: true })` sets `Notification.emailPending` | The only worker that delivers `emailPending` rows is the SEO one (`src/lib/seo/intelligence/notifications.ts`), and it filters `type startsWith "seo_"`. `growth_*` emails were never delivered. The new engine has its own email adapter (`sendEmail` in `src/lib/email/resend.ts`), off by default. |
| Mobile push | Partial | `src/lib/mobile/push.ts` (`enqueueMobilePush` on every `notify`) | Gated by env `MOBILE_API_ENABLED` + `MOBILE_PUSH_ENABLED`. The engine only enqueues push when its own push channel is on. |
| SMS (Kavenegar, sms.ir) | Unused for follow-up | `src/lib/sms/*` | Used for OTP only. No marketing SMS consent exists, so no follow-up adapter was built. |
| WhatsApp | Missing | — | No integration or credentials. Shown as unavailable in admin. |
| Instagram DM to our own users | Missing (by design) | — | Meta only allows a DM inside a user-started conversation or a comment reply. A cold DM to a customer is not possible, and was not built. |
| Opt-out / unsubscribe | Full | `GrowthProfile.unsubscribedAt`, `GET /api/growth/unsubscribe` (HMAC link), `POST /api/growth/consent` | |
| Per-channel suppression list | Missing | — | **Added:** `FollowupSuppression` (user × channel). |
| Quiet hours | Partial | `inQuietHours` (Tehran) | Used only to skip a run. The engine now reschedules to the end of the quiet window. |
| Holdout / experiments | Missing | — | **Added:** a deterministic per-rule holdout, 0 % by default. |

## 4. Campaigns and Instagram

| Capability | Status | Where | Notes |
|---|---|---|---|
| Growth campaigns (UTM) | Full | `GrowthCampaign`, Admin → Campaigns, `campaignReport` | Signups, first value, paid and CAC only when spend is entered. |
| Instagram comment → DM automation | Full (tenant feature) | `src/app/api/webhooks/instagram/route.ts`, `InstagramCommentCampaign`, tests in `directMessaging.test.ts` | Keyword match, dedupe on `commentId`, follow gate, tracked links (`/api/social/instagram/campaigns/link`). It works for whichever business connected Instagram. AIFekr's own page can use it only if its business is connected in that workspace. |
| Tracked DM link → attribution | Disconnected | `campaigns/link/route.ts` | It counted clicks but recorded no GrowthTouch. A signed-out user then lost the UTM (§1). **Fixed here:** for links to our own host, the redirect records the touch server-side and sets the first-party anon cookie. |
| AIFekr Live launch campaign (`instagram_aifekr_live_launch`) | Missing | — | **Added:** a definition, an admin card with status (connected / comment campaign exists / disabled), a link builder and a Live funnel. Nothing is created on Instagram automatically. |

## 5. Scheduling and workers

| Job | Status | Notes |
|---|---|---|
| `/api/cron/growth-lifecycle` (hourly, cron.d / root crontab) | Full, sends nothing | Now runs the follow-up engine (plan + process). With the engine off (the default) it records nothing and sends nothing. |
| `/api/cron/student-reminders`, `/promo-credits`, `/media-job-refunds`, `/zarinpal-reconcile` | Full | Not touched. |
| `/api/cron/lead-followup-sequence`, `/crm-automation`, `/viewing-followup` | Full (tenant CRM) | These follow up on our users' own leads. Out of scope; not touched. |

## 6. Admin

| Area | Status | Where |
|---|---|---|
| Customer Growth Center (overview, campaigns, customers & segments, automations + templates, settings, export) | Full | `/admin/customer-growth`, `src/components/admin/growth/*`, `GET/POST /api/admin/growth` |
| Follow-up engine control, job logs, conversion analytics, Live campaign | Missing | **Added** as tabs in the same center (same design, fa/en, responsive): Follow-up engine, Analytics, Logs, plus a Live card in Campaigns. |

## 7. Risks found

1. **`growth_*` emails silently never sent** (disconnected; above). Not a data risk, but anyone switching it on would believe email works.
2. **Failed sends logged as `sent`** (`notify()` swallows errors). This made the old frequency cap count messages that were never delivered.
3. **Live transcripts in targeting** through the chat first-value query. Fixed.
4. **Two independent send paths** could exist if a second engine were added beside `runLifecycle`. Avoided: there is now one send path, `src/lib/followup/worker.ts`.
