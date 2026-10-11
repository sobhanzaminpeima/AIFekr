# AIFekr FIT and pricing architecture audit

Upstream baseline: 8c88d94 (received 11 October 2026). Next.js 14 App Router, React 18, Prisma 5 / SQLite. Existing JWT cookies and ADMIN/SUPER_ADMIN checks remain authoritative. Existing Student, academy, CRM, voice, referral aliases, payment receipts, ZarinPal, and credit cost configuration are reused.

## Findings and gaps
- Package database supports prices, TRY base, credits and seats, but public catalog filters hardcoded codes. No publish state, arbitrary categories, term prices, granular entitlements or quote expiry.
- Bank and ZarinPal settlement use transactional claims and immutable entitlement snapshots. Preserve every historical payment, balance and expiry.
- FX currently derives toman from official IRR: unsuitable for requested free-market billing. Replace with approved manual rate; never silently substitute official IRR.
- No fitness profiles, workout logs, trainer verification, store or promotions. User module access fails closed; fitness will have its own entitlement, not enable Student/Business.
- Existing localization: Persian, English, Turkish, German. FIT adds Arabic locally without changing existing translations.
- No approved human trainer credentials or actual human consent supplied. Gel4re/Misagh must be demonstration-only, not verified or bookable.
- No configured shipping/payout provider or commercially licensed FX provider evidenced. External settlement and live-rate automation need configuration; don't simulate success.

## Plan and migration
1. Add additive package publishing/category/term/entitlement configuration and authoritative minor-unit quotes. Add approved FX history and first-subscription promotions with unique redemption.
2. Extend existing admin package, currency and revenue UI; dynamic catalogs use active published categories; record immutable checkout rates.
3. Add normalized FIT profiles, trainer profiles, exercise/program revisions, sessions/set logs, wellness diary, digital products/orders, campaigns and audited administration.
4. Mobile gym session draft recovery/idempotent synchronization, AI coach with existing provider and credit ledger; visible AI identities; safety screening.
5. Permission, monetary, promotion, versioning, workout-sync tests; build and mobile review before deploy. Back up production DB and deploy additive migrations only.

## Risks
Health data must stay owner-only and excluded from campaign targeting. Human verification requires actual evidence/admin review. Keep payment settlement separate from display currency. No paid entitlement before verification. Never fake reviews, activity, transformation, purchases or provider responses. Archive historical programs/plans rather than delete. Offline sync must reject stale conflicting edits. Existing subscriptions retain snapshots and dates.
