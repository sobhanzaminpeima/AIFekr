# Customer Growth Engine — System Architecture

Covers system architecture, database schema, event tracking, onboarding, lead scoring, lifecycle automation, communication and subscription integration (merged into one document because they share one small code base: `src/lib/growth/`).

## 1. Components

```
Browser                                 Server (Next.js route handlers)                Data
───────                                 ─────────────────────────────                 ────
GrowthTracker (root layout) ──beacon──▶ POST /api/growth/touch  ──────────────────▶ GrowthTouch (+ afk_aid cookie)
  pricing/module/signup views ────────▶ POST /api/growth/event  (allowlist) ──────▶ GrowthEvent
register / OTP / Google ──────────────▶ onAccountCreated()  ──────────────────────▶ GrowthProfile, user_signed_up
SmartOnboarding (/welcome) ───────────▶ GET/POST /api/growth/onboarding ─────────▶ GrowthProfile, onboarding_* events
Voice Studio ─────────────────────────▶ enqueueSpeech / finishGeneration ────────▶ VoiceStudioGeneration, UsageLog, GrowthEvent
UpgradeCard ──────────────────────────▶ GET /api/growth/upgrade ───────────────────▶ reads Package + voice policy
Checkout (/plans?returnTo=) ──────────▶ /api/payment/create → verify ─────────────▶ Payment (authoritative)
Admin Growth Center ──────────────────▶ GET/POST /api/admin/growth ────────────────▶ facts.ts (grouped reads) → lifecycle.ts
cron ─────────────────────────────────▶ POST /api/cron/growth-lifecycle ──────────▶ GrowthMessage → notify() (in-app/email)
```

| File | Responsibility |
|---|---|
| `src/lib/growth/config.ts` | Settings + feature flags in `SiteSetting["growthSettings"]`, zod-validated with safe defaults, audited saves |
| `src/lib/growth/attribution.ts` | UTM/referrer parsing, `safeInternalPath` (open-redirect guard), path → module |
| `src/lib/growth/events.ts` | `trackEvent` (idempotent, never throws), `recordTouch`, `linkSignup`, client allowlist |
| `src/lib/growth/signup.ts` | Post-signup hook, contextual onboarding, consent changes |
| `src/lib/growth/modules.ts` | Module activation registry (first value, example task, next step, objectives) |
| `src/lib/growth/facts.ts` | Batch facts per customer from authoritative tables (no N+1) |
| `src/lib/growth/lifecycle.ts` | Pure stage / score / band / segment / risk logic |
| `src/lib/growth/analytics.ts` | Overview, funnel, campaign report, customer list, Customer 360, CSV escaping |
| `src/lib/growth/upgrade.ts` | Real-package recommendation |
| `src/lib/growth/automation.ts` | Lifecycle rules, templates, caps, quiet hours, dry run, sending |
| `src/components/growth/*` | Tracker, SmartOnboarding, UpgradeCard |
| `src/components/admin/growth/*` | Growth Center tabs and Customer 360 |

## 2. Database (migration `20261028120000_customer_growth`, additive only)

| Table | Purpose | Key constraints |
|---|---|---|
| `GrowthProfile` | 1:1 with `User`: first/last touch, attribution confidence, intended module, onboarding answers/state, consent, unsubscribe, follow-up | PK `userId`, FK cascade |
| `GrowthEvent` | Behavioural events not stored elsewhere | `idempotencyKey` unique; indexes `(userId,createdAt)`, `(name,createdAt)`, `anonId` |
| `GrowthTouch` | Attribution touches (UTM / referrer host / landing path) | indexes by anon, user, campaign, utmCampaign; FK campaign `SET NULL` |
| `GrowthCampaign` | Admin campaigns | `utmCampaign` unique |
| `GrowthMessage` | Every lifecycle send decision | `idempotencyKey` unique (`rule:user[:period]`) |
| `GrowthNote` | Internal admin notes | FK cascade |

Deleting a user cascades their growth rows. Nothing existing was altered.

## 3. Event tracking

- **Server-authoritative**: `user_signed_up`, `onboarding_completed/skipped`, `ai_generation_succeeded/failed`, `first_voice_generated`, `second_voice_generated`, `first_value_achieved`, `consent_granted/revoked`.
- **Client allowlist** (`CLIENT_EVENTS`): `landing_viewed`, `signup_started`, `pricing_page_viewed`, `plan_selected`, `module_viewed`, `onboarding_started/step_completed/skipped`, `voice_played`, `voice_project_reopened`, `upgrade_prompt_viewed/clicked`, `demo_requested`.
- **Read from authoritative tables, never from events**: checkout started/failed/succeeded (`Payment`), credit consumption and refunds (`UsageLog`), successful outputs per module (artifact tables, see `facts.ts`).
- Metadata is flat, ≤12 keys, strings ≤120 chars; prompts, content, tokens and payment data are never recorded.
- `/api/growth/*` is rate-limited at 40 requests/minute in `src/proxy.ts`.

## 4. Attribution and campaign routing

1. Landing with UTM or an external referrer → `GrowthTouch` (first-party `afk_aid` cookie, 180 days, httpOnly). Direct visits create nothing.
2. Signed-out visit to any product page → `/login?redirect=<path>`; login keeps it for the register link, OTP and Google.
3. On account creation `onAccountCreated` links touches/events to the user, sets first/last touch and confidence (`utm` / `referrer` / `direct` / `unknown`).
4. If the return path is a module page and no plan was chosen, the general `/welcome` wizard is skipped (`onboardingState = contextual`) and the user lands on the module.
5. `/features/<slug>` CTAs carry `redirect=<module route>`; a new `/features/voice-studio` landing page exists.

## 5. Onboarding

`/welcome` shows `SmartOnboarding` (flag `smart_onboarding_enabled`) for personal/business signups without a pre-selected plan; plan purchases, student and fitness accounts keep the existing wizard. Steps: objective → persona (optional) → intent (optional) → recommendation (module, first task, expected result, credits). Every step is saved (resume), skip is one click, and `onboarding_completed` is distinct from `first_value_achieved`.

## 6. Scoring and segments

Rules (defaults; editable in Settings): onboarding 10, first value 20, returned another day 15, 3+ results in one module 15, pricing viewed 10, checkout started 20, demo requested 10 — each counted once per scoring window, normalised to 0–100. Bands: <40 activation, 40–79 nurture, ≥80 sales. Segments and their thresholds are listed in the Customers tab. The score is a prioritisation aid, not a purchase probability.

## 7. Lifecycle automation and communication

12 rules (`RULES` in `automation.ts`): welcome, getting started 24h, second workflow day 3, plan benefits day 5 (promotional), low credits day 7 (promotional), help offer day 10 (promotional), feedback day 14, Voice Studio first audio, inactive return, payment failed, post-purchase onboarding, renewal soon.

Sending requires **all** of: `lifecycle_automation_enabled` + `automated_communications_enabled` (only a SUPER_ADMIN can turn these on), the rule enabled, not in Tehran quiet hours, user not unsubscribed, frequency caps (default 1 per 48h, 4 per 14 days), unique idempotency key, and for promotional rules the user must not be paying. Email is added only with explicit `marketingConsent` and includes a signed one-click unsubscribe link. Eligibility is evaluated at run time. The admin preview runs the same code with no writes.

## 8. Subscription integration

- `upgrade.ts` reads `Package` (published, active, visible) and, for Voice Studio, the `allowedPlans` of the Voice Studio policy; it mirrors `activatePlanForPayment` (`TEAM_*` → `TEAM`). Price, credits and duration are shown exactly as stored; no recommendation is shown when none qualifies.
- The upgrade button opens the existing checkout `/plans?plan=…&returnTo=/voice-studio`; `payment/create` stores the module return path, `payment/verify` returns the buyer there, and Voice Studio reopens the last project.
- Voice Studio trial (`trialGenerations`, default **0 = off**; `trialMaxSeconds` default 30) lets accounts outside `allowedPlans` create short samples paid from their own credits through the normal reservation/refund ledger; failed or cancelled samples do not count. Re-checked inside the reservation transaction.
