// Next.js deliberately skips .env.local when NODE_ENV=test (so a
// developer's local secrets never leak into test runs) — which is exactly
// the NODE_ENV Vitest sets by default, so @next/env's loadEnvConfig()
// returns nothing useful here despite working fine outside Vitest. Prisma
// resolves SQLite URLs relative to prisma/schema.prisma, so `file:./vitest.db`
// points at an isolated, ignored repository-local test database. Never
// override a DATABASE_URL the environment already set explicitly.
process.env.DATABASE_URL ||= "file:./vitest.db";
