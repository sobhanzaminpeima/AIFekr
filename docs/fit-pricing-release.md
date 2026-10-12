# FIT and dynamic billing delivery status

Baseline upstream 8c88d94. Additive migration 20261011140000_fit_dynamic_billing. No historic payment, invoice, subscription expiry, credit balance, or purchased entitlement is repriced.

## Implemented
- Database-backed package categories, publication state, public visibility, exact integer term prices, wallet allocations and entitlement configuration; authenticated whitelisted admin CRUD, audit and cache invalidation; archive rather than delete.
- Existing Growth: USD 219 monthly / 579 quarterly. Existing Scale: USD 349 monthly / 949 quarterly. Student TRY 1199 monthly / 2799 quarterly. FIT USD 50 / 150 / 300; no unconfigured discount.
- Dynamic public catalogs and currency selector; only supported configured terms; owner-bound 15-minute monetary quotes. Decimal rates use BigInt rational arithmetic. IRT remains toman, IRR is 10x toman for ZarinPal.
- Approved FX history and protected manual override. Official IRR is never used for free-market toman. Missing/stale approved rates fail closed. XE TRY/EUR synchronization is implemented with encrypted server-side credentials, bounded refresh cadence, validation and health status.
- First-payment bonus configuration and unique redemption reservation; bonus access days and bonus credits separate; verified-payment transaction honors reserved snapshot and prevents duplicate activation.
- Independent FIT profile/expiry, adults-only consent, AI and demo badges, FIKA/FIKO/Gel4re/Misagh supplied boards, searchable directory and comparison, eight editable starter templates, exercise instructions, immutable workout snapshots, real set logs, completion guards, optimistic offline draft synchronization, rest timer, diary and real history.
- FIT coach uses existing provider router and existing guarded credit ledger, with visible maximum cost and no failed-generation charge. User fitness data is owner-scoped; never passed to advertising targeting.
- Admin FIT summary, program editor/versioning, member/exercise/trainer records. Shared admin design improves referrals, accounting and package management.
- FIT UI: English, Persian, Turkish, Arabic and German; existing global German support retained. Trainer biography/program content currently English fallback, not fully localized source content.

## Not complete / blocked
The two master prompts are NOT fully implemented. Automated carrier/shipping integrations, automatic bank refund/payout execution, country-specific tax rules, multi-item carts, video-course commerce, trainer sponsored campaigns, challenge/community functionality, automatic individualized workout adaptation, complete clinical nutrition review, exercise video library, PWA installation/service-worker offline operation and background sync remain unfinished. Current offline behavior is local draft recovery with manual sync while page is open. No fake orders, reviews, bookings or payout behavior are exposed.

Package builder custom limits are stored; not every downstream legacy module consumes arbitrary custom limits yet. Verified-student eligibility and monthly replenishment scheduler require additional implementation; do not advertise those as enforced. Existing allocations preserve their semantics. Global Arabic navigation and all source-content translations remain unfinished.

## Required configuration before payment rollout
Admin must configure approved USD→TRY and USD→IRT free-market rates (and EUR when used) under /admin/billing/rates, with source and validity. No test rates may be copied into production. Manual IRT rates must be renewed before expiry, or replaced by a configured free-market provider. Checkout refuses missing approved rates. The supplied XE credential was verified. A user-authorized current-market IRT fallback is recorded with its source and a 24-hour validity; it is not the XE IRR quote. Do not activate this billing release if this would break current live purchases.

## Security and deployment
Use consistent SQLite backup, preserve shared uploads/env, migrate deploy only, validate FK/user/balance preservation. Build and smoke-test separate preview before changing PM2 ai-platform. Never expose provider credentials or claim external payment/payout integrations tested without real verification.

Fitness starter education reference: https://www.cdc.gov/physical-activity-basics/adding-adults/ . These templates are general education, not individualized medical prescriptions.

## Continuation review — 2026-10-12
- Server preview b946938 responds 200 for FIT and packages; private routes redirect unauthenticated clients. Production ai-platform remains on f632999. Preview uses an isolated database and Prisma client.
- Workout draft recovery checks ownership, authoritative completion state and revision; completed/deleted drafts are not restored.
- Expired members can export and delete their own health notes/history; explicit confirmation is required. Subscription expiry and wallets are preserved; deletions are audited. Age/consent and billing eligibility profile remain retained.
- FIT media and voice allocations are granted once during verified settlement. Quotes now lock module configuration, wallet allowances, discount attribution and accounting original amount; later package edits do not alter these entitlements. Failed/rejected bonus reservations release with audit history.
- FIT-only users enter /fitness rather than unrelated business dashboards. German FIT controls, diary types and accessible package dialog keyboard navigation added.

## XE integration — 2026-10-12
- Supplied production-format key authenticated successfully via Bearer headers to the official XE v1 endpoint. Account metadata is not exposed to students. No credentials are committed.
- Latest supplied quote timestamp: 2026-10-11T00:00:00Z; USD→TRY 49.419403874 and USD→EUR 0.8927348757. Provider IRR quote differed materially from the free market and is excluded from IRT pricing.
- Manual free-market fallback: Bonbast USD sell 264,000 toman, source display 2026-10-11 14:03; cross-checked against TGJU. Approved by user instruction to use current market rates; 24-hour validity. This is the latest available checked quote, not a fabricated October 12 market update.
- GET /api/cron/billing-rates reuses existing cron-secret authentication; provider refresh coalesces requests and persists cooldown across workers. Admin /admin/billing/rates manages masked configuration and manual rates.
- EUR settlement is available independently of the displayed price currency; it uses the existing Euro IBAN checkout. Growth/Scale retain their pre-existing monthly-credit-times-term convention, granted upfront; historical snapshots/balances stay unchanged.
- FIKA/FIKO standalone supplied portraits replace the character boards.

## Marketplace continuation — 2026-10-12
- Referral commissions now apply to every successful purchase. Per-payment ledger identities prevent duplicates; the referred buyer's credit bonus remains one-time. Existing commission rows prevent retroactive duplicate rewards. No historical purchases are automatically backfilled.
- Added additive migration `20261012150000_fit_marketplace`: trainer applications, availability, bookings, orders, seller ledger and verified reviews. Existing profile/program/product tables remain intact.
- Trainer applications and admin credential review; active human sellers create availability and draft products. Demo/AI profiles cannot sell. Admin reviews digital PDFs privately before publication.
- Bank receipt checkout reuses existing payment records, admin review and accounting. Physical inventory and booking slots are reserved atomically. Digital files are private and accessible only to the paid owner. FIT checkout and payment history now have dedicated routes outside the business dashboard.
- Marketplace settlement supports existing Zarinpal for toman and TRY/EUR bank transfers. Product and booking prices may be configured in USD/TRY/EUR. Carrier APIs, multi-item carts and country-specific tax calculation are not implemented yet. Existing subscription/credit Zarinpal checkout is preserved.
- Human session completion and physical fulfillment require admin records with real delivery reference. Refunds and seller payouts are externally performed and then recorded by admin with reference/reason; no automatic money transfer is claimed. Refunded sales reverse seller liabilities and related referral commission. Already-paid sellers receive an auditable debt entry.
- Global marketplace commission is configurable separately from affiliate commission. Approved reviews require a completed paid booking.
- Set `FIT_PRIVATE_UPLOAD_DIR` to a persistent directory outside public document roots; preserve it across releases/backups. Digital products currently support PDFs, up to 10 MB. Trainer credential PDFs are uploaded privately and all submitted documents must be opened by the reviewing administrator before approval, with an audited reason. Automated identity/KYC verification is not claimed.
- Schedule authenticated `/api/cron/fitness-marketplace` hourly to release unpaid 24-hour holds; orders with receipts are retained for review. No database reset is required.
- Student/business historical subscriptions, invoices and credit balances are not altered by the migration. Existing core master-prompt omissions outside marketplace remain documented above.

## Platform and payment recovery
FIT routes now reuse the existing PlatformShell sidebar, mobile navigation, session watchdog and pending-payment notice. FIT credit scope/expiry stays independent from the business subscription. Unauthenticated checkout links preserve their route through login.
Bank orders remain stored server-side when the user closes the page or opens a bank application. Payment history and the persistent pending-order notice recover the receipt-upload route. The transfer acknowledgement persists per payment on this device; selected upload files must be reselected after a full browser restart. This acknowledgement is not proof of payment.

## Advanced programs and reports
The sidebar language is authoritative for FIT and its marketplace; no duplicate language selector remains in the FIT header. Added four experienced-lifter upper/lower strength and hypertrophy sessions with nine exercise instructions and localized program guidance. Additive migration `20261012180000_advanced_fit_programs` uses INSERT OR IGNORE and preserves historical workouts.
Weekly/monthly reports use rolling 7/30-day UTC windows from authoritative session records, only completed sessions and completed nonzero-repetition sets. They compare the previous equal-length period and group results by program. Load volume is recorded external weight times repetitions; bodyweight contribution and changes in muscle size are not inferred. RPE is shown only where actually recorded. Reports never prescribe automatic load increases.
