// Next.js deliberately skips .env.local when NODE_ENV=test (so a
// developer's local secrets never leak into test runs) — which is exactly
// the NODE_ENV Vitest sets by default, so @next/env's loadEnvConfig()
// returns nothing useful here despite working fine outside Vitest. Tests
// that touch a real Prisma client (e.g. src/lib/accounting/ledger.test.ts)
// need SOME DATABASE_URL, so fall back to the same local dev database every
// manual script in this project's deploy workflow already points at —
// never overriding a DATABASE_URL the environment already set explicitly.
process.env.DATABASE_URL ||= "file:./prisma/dev.db";
