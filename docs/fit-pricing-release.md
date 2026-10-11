# FIT and dynamic billing delivery status

Baseline upstream 8c88d94. Additive migration 20261011140000_fit_dynamic_billing. No historic payment, invoice, subscription expiry, credit balance, or purchased entitlement is repriced.

## Implemented
- Database-backed package categories, publication state, public visibility, exact integer term prices, wallet allocations and entitlement configuration; authenticated whitelisted admin CRUD, audit and cache invalidation; archive rather than delete.
- Existing Growth: USD 219 monthly / 579 quarterly. Existing Scale: USD 349 monthly / 949 quarterly. Student TRY 1199 monthly / 2799 quarterly. FIT USD 50 / 150 / 300; no unconfigured discount.
- Dynamic public catalogs and currency selector; only supported configured terms; owner-bound 15-minute monetary quotes. Decimal rates use BigInt rational arithmetic. IRT remains toman, IRR is 10x toman for ZarinPal.
- Approved FX history and protected manual override. Official IRR is never used for free-market toman. Missing/stale approved rates fail closed. Automatic licensed provider sync is not configured.
- First-payment bonus configuration and unique redemption reservation; bonus access days and bonus credits separate; verified-payment transaction honors reserved snapshot and prevents duplicate activation.
- Independent FIT profile/expiry, adults-only consent, AI and demo badges, FIKA/FIKO/Gel4re/Misagh supplied boards, searchable directory and comparison, eight editable starter templates, exercise instructions, immutable workout snapshots, real set logs, completion guards, optimistic offline draft synchronization, rest timer, diary and real history.
- FIT coach uses existing provider router and existing guarded credit ledger, with visible maximum cost and no failed-generation charge. User fitness data is owner-scoped; never passed to advertising targeting.
- Admin FIT summary, program editor/versioning, member/exercise/trainer records. Shared admin design improves referrals, accounting and package management.
- FIT UI: English, Persian, Turkish, Arabic and German; existing global German support retained. Trainer biography/program content currently English fallback, not fully localized source content.

## Not complete / blocked
The two master prompts are NOT fully implemented. Human trainer application/credential uploads, real bookings/availability, verified reviews, complete seller storefront commerce, shipping, refunds, commission and payout processing, trainer sponsored campaigns, challenge/community functionality, automatic individualized workout adaptation, complete clinical nutrition review, exercise video library, PWA installation/service-worker offline operation and background sync remain unfinished. Current offline behavior is local draft recovery with manual sync while page is open. No fake orders, reviews, bookings or payout behavior are exposed.

Package builder custom limits are stored; not every downstream legacy module consumes arbitrary custom limits yet. Verified-student eligibility and monthly replenishment scheduler require additional implementation; do not advertise those as enforced. Existing allocations preserve their semantics. Global Arabic navigation and all source-content translations remain unfinished.

## Required configuration before payment rollout
Admin must configure approved USD→TRY and USD→IRT free-market rates (and EUR when used) under /admin/billing/rates, with source and validity. No test rates may be copied into production. Checkout refuses missing approved rates. The requested rate information has been asked for and is pending. Do not activate this billing release if this would break current live purchases.

## Security and deployment
Use consistent SQLite backup, preserve shared uploads/env, migrate deploy only, validate FK/user/balance preservation. Build and smoke-test separate preview before changing PM2 ai-platform. Never expose provider credentials or claim external payment/payout integrations tested without real verification.

Fitness starter education reference: https://www.cdc.gov/physical-activity-basics/adding-adults/ . These templates are general education, not individualized medical prescriptions.

## Continuation review — 2026-10-12
- Server preview b946938 responds 200 for FIT and packages; private routes redirect unauthenticated clients. Production ai-platform remains on f632999. Preview uses an isolated database and Prisma client.
- Workout draft recovery checks ownership, authoritative completion state and revision; completed/deleted drafts are not restored.
- Expired members can export and delete their own health notes/history; explicit confirmation is required. Subscription expiry and wallets are preserved; deletions are audited. Age/consent and billing eligibility profile remain retained.
- FIT media and voice allocations are granted once during verified settlement. Quotes now lock module configuration, wallet allowances, discount attribution and accounting original amount; later package edits do not alter these entitlements. Failed/rejected bonus reservations release with audit history.
- FIT-only users enter /fitness rather than unrelated business dashboards. German FIT controls, diary types and accessible package dialog keyboard navigation added.
