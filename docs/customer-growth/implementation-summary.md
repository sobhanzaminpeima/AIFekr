# Implementation Summary

Branch `feat/customer-growth` in `ai-platform-voice` (from `main` `b89eea5`). **Not committed, not deployed.**

## What exists now
- Campaign attribution (first/last touch, confidence, no guessing), campaign builder with trackable URLs, per-campaign funnel/revenue/CAC.
- Destination preserved through login, signup, OTP and Google; module-campaign signups skip the general wizard and land in the module.
- `/features/voice-studio` landing page.
- Smart onboarding (save/resume/skip) that only recommends enabled modules.
- Server-side first-value evidence for 12 modules; Voice Studio success/failure events from the final generation state.
- Voice Studio trial (configurable, ledgered, off by default) and contextual upgrade card from real packages, returning to Voice Studio after payment with the last project.
- Admin Customer Growth Center: overview/funnel with definitions, campaigns, customers with 11 segments and explainable score, Customer 360 with timeline/notes/follow-up, lifecycle automation preview and settings.
- 12 lifecycle rules with consent, caps, quiet hours, idempotency, dry-run preview; nothing sends by default.

## Reused
`UsageLog`, `Payment`, `Package`, `SiteSetting`, `AuditLog`, `notify()` (in-app/email/push queue), `requireAdmin`, `isCronAuthorized`, `ModuleRegistry`, Voice Studio ledger, existing checkout and `entitlementSnapshot.returnPath`.

## Findings for the owner
1. Voice Studio `allowedPlans` = PRO, BUSINESS, TEAM, AGENCY: free users cannot generate; `PRO_USD`, `PLUS`, `ALPHA` etc. buyers also cannot (their `User.plan` is the package code). Decide whether to add codes or enable the trial.
2. No cookie-consent banner exists (relevant for EU visitors).
3. Two pre-existing failing tests in `src/lib/fitness/adminAccess.integration.test.ts`.

## Known limitations
- AI-written summaries not implemented (rule-based next action instead).
- No A/B experiments, no push/SMS/WhatsApp channels.
- Video Factory first value = project created, not a finished export.
- Visitor counts only include campaign/referral landings.
- Analytics compute on request over up to 5,000 customers; add caching if the user base grows past that.
- No settings-page toggle for marketing consent yet (API exists: `/api/growth/consent`).
