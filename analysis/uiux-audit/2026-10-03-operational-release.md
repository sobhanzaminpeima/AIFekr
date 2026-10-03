# Business bundles and operational release review

## Pricing and activation

The main business purchase flow now offers three complete packages, with the same capabilities and different capacity:

| Package | USD / month | Members | Credits per purchased month |
| --- | ---: | ---: | ---: |
| Launch / شروع | 149 | 3 | 4,000 |
| Growth / رشد | 349 | 10 | 12,000 |
| Scale / مقیاس | 699 | 25 | 30,000 |

Growth is labeled recommended for growing teams, not falsely described as a best seller. The pricing ladder uses progressively lower cost per credit; there are no fabricated discounts, countdowns, crossed-out prices or sales statistics. Existing 3-month / 6-month savings are 5% / 10%. The monthly equivalent and full upfront term total are both shown. Actual package rows remain administrator-controlled. Seeding creates missing business codes only and preserves existing package pricing and legacy customers.

A single approved business order grants shared Team credits, CRM TEAM and Voice workspace access. Business credits scale by purchased months and are allocated once at approval. All registered industry capabilities become available while the paid business subscription is active; explicit per-customer admin overrides remain authoritative. Members/credit pool remain server scoped. External provider connections, phone numbers and call charges are disclosed separately; no unlimited usage is promised. A member of another owner's team cannot purchase a separate owner's bundle. A downgrade below occupied seats is rejected before payment and checked again at approval.

Students and legacy standalone CRM subscriptions remain separate. Existing paid orders use their original snapshots. No Prisma schema change was introduced for this release.

## Executed checks

- Complete Vitest run: **711 tests passed, 98 files passed, zero failed/skipped**, with RUN_BANK_INTEGRATION=1 and isolated vitest.db. Schema creation succeeded before the complete run. An earlier failed run against an uninitialized test database was corrected, rather than suppressing failures. An outdated public-pricing test was updated to the now-shared USD base and mocked deterministic rates.
- The suite includes auth/JWT/password, credits and refund/idempotency, tenant/business isolation, organization provisioning/deletion, accounting, student sessions/planner/export, lead generation, CRM/industry permissions, orchestration, social direct delivery/webhooks and SEO services. Third-party provider calls are mocked where the suite defines mocks; passing them does not certify live Meta/Vapi/WordPress/OpenAI/Anthropic availability.
- Additional business tests verify multi-month credit snapshot, owner-only purchases, seat downgrade rejection, atomic AI+CRM+Voice activation, no duplicate credit grant and expiry-driven module gating.
- Real HTTP against the production build on isolated localhost preview: **29 checks passed**. Authentication, bad/null payload/currency/term, pending-order reuse, wrong-user access, buyer/admin roles, missing receipt, invalid/oversized/duplicate receipt, owner-only download, delayed activation, approval/replay, complete bundle entitlements and industry module API, TRY/EUR orders, required rejection note, rejected-order replay and new order after rejection.
- Production build passed; TypeScript passed separately because Next build skips types/lint. Targeted ESLint passed. SQLite online-backup helper was executed against the test database and created a valid backup at the intended resolved Prisma-relative location.
- Browser: all three bundles, 3-month EUR selection, preserved term/currency, Growth link through plans and checkout. Landing and plans showed the same EUR 882.56 total; checkout matched. 390 px previously reviewed main platform destinations had no horizontal overflow. The new bundles were checked in desktop/mobile and four public languages in the final preview. No real bank transfer was made.

## Release mechanics and outstanding production verification

The deployment script now seeds missing business bundles, uses a consistent online SQLite backup, preserves server configuration, and ends without indefinitely streaming PM2 logs. The intended source release includes the preceding UI/payment/localization/SEO work described in the two earlier reports.

JARVIS classification: browser-safe pricing/checkout/account capabilities on AIFekr. JARVIS is a separate repository/server process; its frontend and SSO permissions are not silently modified by this release.

Production deployment needs an SSH account, project path and usable authentication method. No configured local SSH key/config was discovered. These were requested from the user while completing implementation and tests. Server-wide integrations, actual banking, outbound communications, paid provider generation and real production approval are not falsely reported as tested. After deployment, verify the actual domain, package rows, bank settings, private noindex, locale canonicals/sitemap, PM2 status and logs; submit/monitor Search Console separately.
