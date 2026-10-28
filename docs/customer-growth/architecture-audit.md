# Customer Growth Engine — Architecture Audit

Date: 2026-10-28 · Branch: `feat/customer-growth` (from `main` `b89eea5`)

## 1. Current architecture (as found)

| Area | Implementation |
|---|---|
| Frontend / backend | Next.js 16 (App Router, Turbopack), React 19, route handlers under `src/app/api` |
| Database | SQLite through Prisma 5.22 (`prisma/schema.prisma`, 209 models, 150 applied migrations) |
| Auth | Custom JWT cookie (`src/lib/auth/jwt.ts`), `requireAuth` / `requireAdmin` in `src/lib/auth/middleware.ts`; password, phone OTP and Google sign-in (`src/app/api/auth/*`) |
| Roles | `User.role`: `USER`, `ADMIN`, `SUPER_ADMIN` |
| Edge logic | `src/proxy.ts`: rate limits, module on/off switch, sets `x-aifekr-path` (path + query) |
| i18n | `useTranslation()` / `tri(lang, fa, en, de, tr)`; RTL for `fa` |
| Background work | pm2 processes + cron HTTP routes under `src/app/api/cron/*` authorised by `isCronAuthorized` |
| Settings / flags | `SiteSetting` key/value JSON (e.g. `voiceStudioSettings`), `ModuleRegistry` (status, minPlan), `UserModuleOverride` |
| Billing | `Package` (plans, prices in Rial/USD/TRY, credits, entitlements), `Payment` (PENDING → SUCCESS/FAILED, `amount` in Toman), `activatePlanForPayment` in `src/lib/repositories/paymentRepository.ts`, ZarinPal verify + NOWPayments webhook + manual bank-transfer review |
| Credits | `User.credits` (+ wallet split columns), ledger `UsageLog` written by `src/lib/utils/teamCredits.ts` (`chargeAndLog`, `reserveLoggedCredits`, refunds as negative rows) |
| Notifications | `Notification` rows via `notify()` (`src/lib/notifications/create.ts`), optional email (`emailPending` → Resend worker), mobile push queue |
| Email | Resend (`src/lib/email/resend.ts`) |
| Admin | `/admin/*`, navigation in `src/components/admin/AdminNavigation.tsx` (`adminGroups`) |
| Analytics | `/admin/analytics` = UsageLog feature counts + DAU; no acquisition, funnel or lifecycle analytics |
| Marketing pages | `/features/[slug]` driven by `src/lib/marketing/catalog.ts`; `/pricing`; checkout at `/plans?plan=CODE&period=monthly` |

## 2. Reusable components

- `UsageLog`: authoritative credit ledger (charges, refunds) — used for credit consumption and failed-operation detection (refund rows).
- Artifact tables written only on success: `GeneratedImage`, `GeneratedVideo`, `GeneratedMusic`, `VoiceStudioGeneration` (status `READY`), `VideoFactoryProject`, `SeoAudit`, `StudentMaterial`, `GeneratedWebsite`, `SocialPost`, `Conversation`, `FitnessProfile`, `CrmContact` (owner) — used as server-authoritative first-value / success evidence, including for historical users.
- `Payment`: authoritative checkout start (row created), failure and success — no client event is trusted for money.
- `Package`: the only source for plan names, prices, credits and durations used in upgrade recommendations.
- `SiteSetting`: holds the growth configuration and feature flags (same pattern as `voiceStudioSettings`).
- `notify()`: the only in-app/email delivery path used by lifecycle messages.
- `AuditLog`: admin configuration changes.
- `isCronAuthorized`: lifecycle runner authorisation.

## 3. Missing functionality

1. **No acquisition attribution** — UTM parameters and referrers are never stored.
2. **Intended destination lost at sign-in** — `PlatformShell` redirects signed-out visitors to `/login` without `redirect`; `/register` honours `redirect` only for `entry=chat`. A visitor from a Voice Studio ad lands on the chat/welcome flow.
3. **Forced general onboarding** — every new user without `onboardingDone` is sent to `/welcome`, even when they came for one module.
4. **No Voice Studio landing page** in the marketing catalog.
5. **No event store** for non-financial behaviour (pricing views, onboarding steps, module views).
6. **No marketing consent / unsubscribe** — registration must not be treated as consent.
7. **No lifecycle stage, segment, score, Customer 360 view, campaign registry or lifecycle automation.**

## 4. Data boundaries

The tenant CRM (`CrmContact`, `CrmDeal`, … owned by each customer, admin view `/admin/crm`) is **customer data of AIFekr's customers**. The growth engine never reads or writes it, except a per-owner *count* used as "CRM first value" evidence for that owner. All new tables are prefixed `Growth*`, keyed by `User.id` of AIFekr's own users, and reachable only through `requireAdmin` routes (plus the user's own consent/onboarding/event endpoints).

## 5. Security risks found / addressed

- Open redirect: the new generic `redirect` handling uses `safeInternalPath()` (relative path, no `//`, no `\`, allowlisted prefixes).
- Forged financial events: client event ingestion accepts an allowlist of non-financial names only; purchases, checkouts and credit usage are read from `Payment` / `UsageLog`.
- Bulk export: CSV export restricted to `SUPER_ADMIN`, audited.
- Template injection: templates support a fixed variable set; values are plain-text escaped and unknown variables are rejected at save time.
- Messaging: email requires explicit `marketingConsent`; nothing is sent unless both automation flags are on and the rule is enabled (default off).

## 6. Technical debt observed

- `User.credits` coexists with wallet columns during a migration.
- `UsageLog.type` strings are free text; module mapping is maintained in `src/lib/growth/modules.ts`.
- No cookie-consent banner exists; the anonymous attribution cookie is first-party, stores no IP and no personal data (see `security-review.md`).

## 7. Implementation order (executed)

1. Foundation: `Growth*` tables (additive migration), settings + flags, event ingestion, attribution touch capture.
2. Campaign routing: safe redirect through sign-in/sign-up, contextual onboarding bypass for module campaigns, Voice Studio landing page.
3. Module activation registry + server-side success evidence; Voice Studio first-value events and contextual upgrade from real packages.
4. Admin Growth Center: overview KPIs + funnel with definitions, campaigns (builder, URLs, per-campaign funnel), customers (stage, score, segments), Customer 360 timeline, notes, consent.
5. Lifecycle automation: rules, preview (dry run), frequency caps, consent, idempotent sends — disabled by default.
6. Tests and documentation.

## 8. Migration strategy

One additive migration (`prisma/migrations/20261028120000_customer_growth`) creating new tables only. No existing column is changed or dropped. Rollback: deploy the previous build; the new tables are ignored by it and can be dropped later with explicit approval.

## 9. Testing strategy

Unit tests for pure logic (attribution parsing, safe redirects, stage/score/segments, template rendering, automation eligibility, frequency caps); typecheck + lint; existing suites re-run for regressions; manual browser verification of the campaign → register → module path in the local preview.
