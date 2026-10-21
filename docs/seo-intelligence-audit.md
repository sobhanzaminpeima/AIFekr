# AIFekr SEO Intelligence — audit and implementation plan

Reviewed 2026-10-08. Implementation checklist is authoritative; unfinished items are not presented as available.

## Existing architecture and reusable components

Next.js 14 App Router, React 18, Tailwind 3, TypeScript, Prisma 5, SQLite. JWT cookies are checked against live accounts and subscription expiry. Organization/BusinessWorkspace memberships and legacy Team wallets coexist. User/Team.credits remains the authoritative spending balance; aiCredits is a mirror. Reuse reserveLoggedCredits, UsageLog, payer snapshots and conditional refunds. Do not add a wallet.

Existing SEO pages /seo, /seo/sites and /seo/agent-pipeline provide technical/mobile audits, history, GSC performance and WordPress/content workflows. Preserve SeoSite, SeoAudit, SeoContentPlan and SeoRankSnapshot. GSC is gated pending OAuth readiness. GSC average position is not a live SERP rank. Reuse existing AI router, AES-GCM secretBox, cron authorization, rate limits, Academy durable-job conventions and PDF renderer. Four UI languages: fa RTL, en, de, tr.

## OpenSEO audit and dependency map

Reviewed https://github.com/every-app/open-seo at immutable commit 89e5a00717cdf049b7c2b4e29646edb3a7d4995b: README, AGENTS, MIT license, manifests, environment configuration, self-hosting docs, MCP authorization, provider core/envelope/pricing, Labs/SERP/backlink services and test structure. Upstream uses TanStack Start/React 19, Drizzle, Cloudflare Workers/Durable Objects, BetterAuth and Autumn. Whole-app import would duplicate authentication and billing and conflict with Next/Prisma. Docker local_noauth must not be exposed publicly. Telemetry will not be imported. Upstream tests have not been executed; its dependencies are not installed.

Native Next API -> existing authentication -> verified business membership -> SEO service -> fixed allowlisted DataForSEO adapter. Durable job -> existing wallet reservation/UsageLog -> provider -> validated observations -> commit/refund. Admin settings -> encrypted credentials and configured pricing. Existing crawls, GSC and WordPress remain reusable. No framework migration or new runtime dependency is needed. Preserve MIT copyright 2026 Ben Senescu in third-party/open-seo.

## Database, routes, APIs and admin impact

Additive ownership/configuration, durable jobs, tracked keywords, observations, schedules and reports. Jobs need immutable actor/tenant/site, idempotency key and input hash, payer snapshot, reservation, actual provider expense, state/error and timestamps. Retain existing rows; backfill tenant ownership only from proven membership. No reset. New /seo/intelligence pages and scoped /api/seo/intelligence APIs; /admin/seo-intelligence for credentials, prices, quotas, queue health and expenses. Credentials never appear in API output.

## Risks and controls

Existing DNS validation followed by independently resolved fetch permits rebinding; mapped hexadecimal IPv6 also needs protection. Pin validated DNS answers into connections, recheck redirects, strip cross-origin credentials, bound response bodies and total time. Ownership must be verified server-side via TXT/file. Enforce organization ACTIVE and view/manage grants. Every result query must carry verified scope. Treat crawled text as untrusted data. Paid timeouts must not automatically retry. Unknown provider expenses remain unknown. Atomic claim/refund prevents duplicate charges. Show quotation and budgets before paid work. CMS writes need explicit preview/approval and audit logs.

## Implementation checklist

- [x] Audit both repositories and select native adapter integration.
- [x] DNS-pinned crawler, bounded bodies, redirects and mapped IPv6 tests; public AIFekr network check passed.
- [x] Encrypted DataForSEO admin configuration, per-action configured pricing and non-billable account probe; live credentials passed HTTP/envelope/task checks on 2026-10-08 in isolated preview.
- [x] Validated keyword, SERP, backlink and competitor adapter contracts (live research awaits credentials).
- [x] Additive ownership/tenant/job migration and authorization tests; local test database migrated, production unchanged.
- [x] Durable credit reservation, idempotency, refunds, expiry reconciliation and reported/unknown expense tests.
- [x] Native research workspace, provider-supported country/language/platform selection, saved domain rank history and scoped formula-safe CSV export.
- [ ] Expanded overview, scheduled tracked keywords and historical charts.
- [x] Native competitor gaps, backlinks/history and sampled AI evidence tools; paid live observations remain untested.
- [ ] Content studio/SEO agent through existing AI architecture and safe approvals.
- [ ] Scheduling, budgets, alerts, integrations, optional GA4 and local SEO.
- [ ] Authoritative branded PDF reporting, administration and analytics.
- [ ] Four-language mobile/accessibility QA and honest landing/pricing discovery.
- [ ] Unit/integration/security/E2E checks, migration rehearsal and rollback notes.

## Prerequisites and migration plan

Technical crawls/history and existing AI/WordPress features work independently of DataForSEO. Keyword metrics, live SERPs, competitive data and backlinks require provider account/access/billing. Owner supplied API credentials; encrypted credentials are configured in the isolated local preview only. Free appendix/user_data authentication and both Labs/AI coverage endpoints passed. Coverage returned 94 markets, including Turkey, Germany and US, excluding Iran. Owner authorized a cumulative $0.50 provider-test cap. Seven adapter actions returned validated live responses for public-domain research; known total expense $0.20938. Live rank checks returned provider envelope status 50000 (internal service failure); the observed follow-up response reported cost zero. These are adapter contract tests, not a verified-site browser enrollment/ledger journey. No funding purchase or production credential installation occurred. GSC needs OAuth configuration and its feature gate; GA4 needs additional access. AI visibility is sampled evidence, never universal visibility or guaranteed rank. Supported markets must come from provider coverage rather than guessed country support.

Rehearse additive migrations against a consistent SQLite copy; compare balances, row counts and pre-existing FK issues. Build/test, back up DB, retain previous release and validate preview before authorized activation. No provider purchase or external CMS publication is authorized. Do not commit analysis clones, fixtures, env files or credential-bearing deployment helpers.

## Initial implementation routes and operation

/seo/intelligence offers website selection/verification, keyword suggestions, top-10 live SERPs by location/language/device, competitors, backlink summaries and referring domains. Native tables display missing metrics as unavailable; history persists in SeoResearchJob. Existing content/audit routes remain available. /admin/seo-intelligence saves encrypted API login/password, service enable flag, explicit per-action base/row USD rates, credit conversion, markup, infrastructure and wallet budget/open-job limits. PUT /api/admin/seo-intelligence requires live admin authorization and creates AuditLog; generic settings cannot read/write this protected configuration. POST /api/admin/seo-intelligence/probe uses free appendix/user_data, without a live paid task. POST /api/seo/intelligence/sites gives DNS/file instructions and verifies server-side. POST /api/seo/intelligence/research previews cost or explicitly reserves it with an idempotency key. GET returns scoped historical observations. POST /api/cron/seo-intelligence claims one queued job and reconciles expired reservations; protect via existing CRON_SECRET and run periodically in the deployment scheduler. No in-request fire-and-forget worker is used. A failed provider request refunds customers even if a known provider expense was incurred; UsageLog records that real expense separately. Unknown expense is null, never fabricated zero.

The schema migration is 20261008143000_seo_intelligence. Set existing TOKEN_ENCRYPTION_KEY (or JWT_SECRET), DATABASE_URL, APP_URL and CRON_SECRET normally; do not put provider passwords into browser environment variables. Source compatibility remains OpenSEO-pinned but current official DataForSEO docs are checked before adopting further endpoints. Existing GSC connect/callback now share publicAppUrl to avoid localhost redirects in production.

## Continuation validation — 2026-10-08

Final full suite: 132 test files passed, 2 skipped; 930 tests passed, 20 skipped. Targeted SEO tests cover bounded provider metadata responses, actual market/platform coverage, refunds with known provider costs, archived queued sites, unknown top-10 positions, exact/subdomain matching and CSV formula escaping. Existing-data migration rehearsal copied uiux-preview.db with SQLite backup API; preserved eight users, 29 usage entries and both credit balances, with no new FK violations. This is a local copy rehearsal, not a production migration. Native admin connection probe also passed through the browser; no password appears in returned settings or the saved proof screenshot.

New read-only GET /api/seo/intelligence/ranks returns up to 200 successful saved observations for a scoped site; format=csv exports them without AI credit charges. Country/language/device are preserved; absence in top ten remains null. No scheduled monitoring is implied.

Build validation discovered an existing Recharts prebuild patch that imported a missing module. The patch now checks the installed helper layout before applying/undoing the split import. An optimized production build passed after using a fresh scratch directory; the latest account-rate import and observed-provider-error build also passed. Previous cached failed builds must not be activated.

### Account rates and observed provider failures

POST /api/admin/seo-intelligence/rates reads the free authenticated appendix/user_data endpoint, extracts only allowlisted action rates and never returns login, password or the account payload. The admin can load, review and save these prices through existing configuration; retail credit conversion/markup is retained. Account-specific prices matched the public pricing references: Labs $0.012/task + $0.00012/result, Live SERP $0.002, backlinks $0.024 + $0.000036/result, mentions $0.1 + $0.001/result. These are configurable snapshots, not permanent hard-coded production prices. Price-multiplying Google operators are rejected for fixed-price rank checks. Observed 50000/null-task errors retain reported zero expense; malformed successful results without authoritative expense remain invalid. No automatic paid retry occurs.

Additional targeted suite: seven files, 42 tests passed; TypeScript and selected lint passed. Native 390px mobile page had no horizontal overflow; saved local proof excludes credentials. Admin native free probe passed. Native browser QA confirmed fa/en/de/tr headings, controls, translated market labels and correct RTL/LTR behavior.

Scheduler entry point: scripts/run-seo-worker.cjs runs once using APP_URL and the existing CRON_SECRET header, with a 240-second bound and no provider retry. Configure it through the production deployment scheduler only when releasing the feature; it has not been scheduled on production. Atomic queue claims protect overlapping invocations.
