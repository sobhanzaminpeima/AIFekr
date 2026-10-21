# AIFekr — Execution Plan
_Created: 2026-10-21_

## PHASE 2 — P0/P1 Security & Reliability Fixes

1. **P0-001** Fix OAuth CSRF: Add signed nonce to state parameter for Instagram + GSC callbacks
2. **P0-002** Fix npm vulnerabilities: `npm audit fix` + axios upgrade
3. **P1-001** Add core automated tests: payment flow, auth, credit deduction, CRM isolation
4. **P1-003** Add GitHub Actions CI workflow: lint → typecheck → test → build
5. **P1-005** Verify + document ZARINPAL_CALLBACK_BASE_URL requirement
6. **P1-006** Add Instagram webhook signature verification
7. **P2-004** Fix credit deduction race condition with atomic transaction

## PHASE 3 — Feature Completion

1. Build `/play` Games module (lobby, AI Quiz Challenge, leaderboard, server-validated scoring)
2. Build Student module scaffold (study companion, notes, quiz, flashcards)
3. Build Fitness module scaffold (coach/trainee, workout plans, progress)
4. Add Real Estate module (listings, leads, appointments)

## PHASE 4 — Module Registry & Admin

1. Create ModuleRegistry table + admin UI
2. Build entitlement middleware (server-side plan enforcement)
3. Admin user management enhancements

## PHASE 5 — Admin UX Redesign

Per-spec: dark charcoal #0B0D10 / orange #FF6B00, responsive, RTL

## PHASE 6 — User Journey Testing

ZarinPal sandbox end-to-end, credit ledger, subscription flow

## PHASE 7 — Remaining Modules + Quality

Observability, indexes, mobile UX, localization, accessibility

## PHASE 8 — Release Preparation

Staging deploy, acceptance tests, production deployment approval
