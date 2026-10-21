# AIFekr — Issue Tracker
_Audit date: 2026-10-21 | Auditor: Claude Code_

## P0 — Critical (Security / Data Loss)

### P0-001: OAuth State Parameter is Plain User ID — CSRF Risk
- **Module**: Social (Instagram), SEO (GSC)
- **Files**: `src/app/api/social/instagram/callback/route.ts`, `src/app/api/seo/gsc/callback/route.ts`
- **Description**: The OAuth `state` parameter contains the raw `userId` string. There is no CSRF token, no nonce, and no signature verification. A malicious page can craft a redirect to the callback URL with an attacker-chosen `userId` in `state`, linking their OAuth token to any victim user account.
- **Steps to Reproduce**: Initiate Instagram/GSC OAuth for user A. Intercept callback. Replace `state` with user B's id. The token is saved to user B's account.
- **Root Cause**: `state` is set to `userId` at auth initiation with no verification at callback.
- **Fix**: Generate a signed, time-limited nonce (HMAC-SHA256 of `userId + timestamp + JWT_SECRET`), store it server-side (Redis/DB) per user, verify it on callback before writing tokens.
- **Status**: OPEN

### P0-002: 29 npm Vulnerabilities (2 Critical, 18 High)
- **Module**: Platform-wide
- **Description**: `npm audit` reports 29 vulnerabilities including 2 critical and 18 high. Key packages: `axios` (prototype pollution, SSRF via HTTP/2 adapter, header injection), `braces` (ReDoS/stack exhaustion), `vitest`/`@vitest/mocker` (path traversal). Axios is used for external provider API calls.
- **Fix**: Run `npm audit fix`; for breaking changes (braces → tailwindcss v4), test incrementally. Pin axios to a patched version.
- **Status**: OPEN

---

## P1 — High (Broken Core Journeys)

### P1-001: Zero Automated Tests
- **Module**: Platform-wide
- **Description**: Vitest is configured and in package.json, but `find src -name "*.test.ts" -o -name "*.spec.ts"` returns nothing. No unit, integration, or E2E tests exist. Every feature change is untested.
- **Fix**: Add at minimum: payment flow test (create/verify cycle), auth middleware test, credit deduction test, CRM tenant isolation test.
- **Status**: OPEN

### P1-002: Modules from Spec Absent — Student, Fitness, Real Estate, Games/Play
- **Module**: Student, Fitness, Real Estate, Games
- **Description**: Four major modules listed in the product spec are entirely absent from the codebase. The `/play` route does not exist.
- **Fix**: Implement per PHASE 3 plan; mark as not-yet-available on plans page to avoid selling non-existent features.
- **Status**: OPEN (planned)

### P1-003: No CI/CD Pipeline
- **Module**: DevOps
- **Description**: No `.github/workflows` directory. Deployments are manual via `scripts/deploy.sh`. No automated build, lint, type-check, or test gate before production.
- **Fix**: Add GitHub Actions workflow: lint → typecheck → test → build → deploy on merge to main.
- **Status**: OPEN

### P1-004: SQLite in Production Config (Prisma Schema)
- **Module**: Platform-wide
- **Description**: `prisma/schema.prisma` datasource is `provider = "sqlite"`. The pg adapter is imported in package.json but the schema default is SQLite. Production on a VPS should use PostgreSQL.
- **Fix**: Confirm DATABASE_URL in production .env points to PostgreSQL and schema is set to `postgresql` (or confirm SQLite is intentional for single-server VPS).
- **Status**: NEEDS VERIFICATION

### P1-005: ZARINPAL_CALLBACK_BASE_URL Domain Mismatch
- **Module**: Payments
- **Description**: Code comment reveals merchant ID is registered under `rosedigital.ir` but app lives on `aifekr.com`. The callback domain must match the registered domain or ZarinPal will reject it. This is a configuration dependency that could silently break all payments if env var is wrong.
- **Fix**: Verify ZARINPAL_CALLBACK_BASE_URL is set correctly in production .env. Document the domain configuration requirement.
- **Status**: NEEDS VERIFICATION

### P1-006: No Webhook Signature Verification for Instagram Webhooks
- **Module**: Social / Instagram
- **Files**: `src/app/api/webhooks/` (if exists), Instagram subscription endpoints
- **Description**: Instagram comment-to-DM webhook must verify `X-Hub-Signature-256` header. Unverified webhooks can be spoofed.
- **Fix**: Verify HMAC-SHA256 signature using `META_APP_SECRET` on all incoming webhook payloads.
- **Status**: NEEDS VERIFICATION

---

## P2 — Medium

### P2-001: Lint Errors (7 unused variables/imports)
- **Files**: AdminSidebar, ChatInterface, DemoChat, Sidebar, ShareButton, fal.ts, providers/index.ts, googleSearchConsole.ts, r2.ts
- **Fix**: Remove unused imports; add explicit types for `any`.
- **Status**: OPEN

### P2-002: No Backup/Restore Documentation
- **Module**: DevOps
- **Description**: No backup procedure documented or automated. SQLite/PostgreSQL data has no verified restore path.
- **Status**: OPEN

### P2-003: Missing Database Indexes for Heavy Queries
- **Module**: Platform-wide
- **Description**: CRM queries filter by `userId` + nested relations on several models. Without indexes on foreign keys Prisma uses full table scans.
- **Fix**: Add `@@index` on high-frequency filter fields (CrmContact.userId, CrmDeal.userId, Payment.userId, etc.).
- **Status**: NEEDS ANALYSIS

### P2-004: Credit Deduction Has No Atomic Reservation
- **Module**: AI Credits
- **Description**: Credits are decremented after AI job completion. Concurrent requests could overdraw credits beyond zero before any single deduction completes.
- **Fix**: Use Prisma's `$transaction` with an optimistic lock or a `decrement` + `where credits >= cost` check.
- **Status**: OPEN

---

## P3 — Low

### P3-001: Missing Referral `referralCode` Uniqueness Race Condition
- **Module**: User / Referral
- **Description**: `referralCode` is unique in schema but generation logic could collide under concurrent signups.
- **Status**: OPEN (low probability)

### P3-002: DemoChat useEffect Missing Dependency
- **File**: `src/components/landing/DemoChat.tsx:105`
- **Fix**: Add `DEMO` to useEffect dependency array or move constant outside component.
- **Status**: OPEN
