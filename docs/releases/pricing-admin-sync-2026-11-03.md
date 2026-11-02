# Landing and admin package synchronization — 2026-11-03

## Changes

- One category registry supplies admin category names/options, classic pricing, and the public-site API consumed by the new UI.
- `/admin/packages` previews each package's actual published landing price for Persian, English, German and Turkish using the same resolver as the landing page. Unpublished/inactive/unsupported offers are marked as absent.
- Package period, duration and allocated credits come from the configured term. Checkout preserves that period instead of forcing monthly.
- The superseded `CHAT_STARTER_30` offer is omitted consistently from new public purchases; existing payment snapshots remain intact.
- Admin package mutations invalidate public pricing routes. Public-site fetches do not retain stale package data.
- Admin can edit the displayed original Toman price for an offer through `compareAtToman`.
- No approved package amounts, exchange rates, account balances or production database settings were changed by this release.

## Validation

- 62 relevant tests passed, including an isolated database integration test that creates a package through the admin API, changes its price/category, verifies the public resolver and admin preview agree, and verifies disabling removes it from the landing output.
- Backend and UI production builds are required before deployment. Release runtime commits: backend `79adcbf7`, UI `093870fc`.
- Deployment uses the existing SSH key, paired preview services, health checks and rollback. No paid provider generation or real payment is part of this validation.
- Interactive authenticated browser acceptance remains unavailable while browser control is disabled; automated checks do not establish that the entire platform is defect-free.

## Deployment result

- Both production builds passed. Paired preview checks passed and production now runs backend `.next-rel-79adcbf7` with UI `093870fc`; both PM2 services are online.
- Public `/`, `/pricing`, `/en`, `/de`, `/tr` and `/api/health` returned 200; unauthenticated `/api/admin/packages` returned 401.
- Public API returned five categories in all four languages, 15 offers in Persian and 14 in each other language. The creator-five offer is absent internationally because no usable USD/TRY price is configured; no rate or price was invented. This absence is visible in the admin preview.
- Existing chat Toman prices remain 199,000 / 499,000 / 1,499,000 and `VF_CREATOR_5` remains 4,250,000 Toman with 500 credits.
- Backend main and accounting branch, and UI first-success-media branch were updated. Previous runtime pair retained for rollback. Available server space remained above 3 GiB.
