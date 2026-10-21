# AIFekr PLAY repository audit — 2026-10-20

## Actual architecture and integration points

- Next.js 14 App Router and React share frontend and server route handlers. Existing dashboard shell: `src/app/(dashboard)`; navigation: `src/components/layout/Sidebar.tsx`. Admin shell: `src/app/admin/layout.tsx`, `src/components/admin/AdminSidebar.tsx`.
- Prisma ORM with SQLite in production, additive migrations in `prisma/migrations`. Existing `User` is the sole identity. No game session, gaming ledger, competition or leaderboard entities currently exist.
- Existing session verification and role checks: `src/lib/auth/middleware.ts` (`requireAuth`, `requireAdmin`); mobile bearer sessions reuse the same identity in `src/lib/auth/mobileSessions.ts`.
- Industry module access uses `IndustryModuleFlag`/`UserModuleOverride` and `src/lib/industry/moduleAccess.ts`; industry-specific catalog is `src/lib/industry/moduleRegistry.ts`. PLAY is platform-wide, so its lifecycle must be stored separately without forcing an industry purchase or changing industry semantics.
- Billing already uses `Package`, `Payment`, locked entitlement snapshots and `src/lib/billing/quotes.ts`. AI billing uses `src/lib/utils/teamCredits.ts` and `UsageLog`. PLAY XP and reward recognition must use separate tables and never change billable credits during gameplay.
- Four platform languages use `src/lib/i18n`, shared sidebar language and RTL. Theme surfaces use CSS variables; existing fitness/video-specific dark CSS must not be copied as a second shell.
- In-app notifications and mobile push: `src/lib/notifications/create.ts`, `src/lib/mobile/push.ts`. Email dispatch must respect existing preferences. Rate limiting: `src/lib/utils/rateLimit.ts`; audit: existing `AuditLog`.
- Current video worker is PM2 polling server checkpoints, with durable `VideoFactoryJob` and `VideoFactoryStep`. PLAY session replay validation should be bounded synchronous deterministic simulation initially; tournament close can reuse authenticated maintenance patterns rather than introducing another queue dependency.
- Vitest is installed. Real isolated SQLite tests exist in `src/lib/video-factory/service.integration.test.ts`. Native rendering tests use real FFmpeg/Remotion. Builds run locally with bounded CPUs and deploy as versioned releases with health checks and rollback.

## Planned data and route impact

Add game/config version, session, verified score, player XP ledger, achievement grant, tournament/entry/result, reward/grant and moderation records linked to existing `User.id`. Unique session submissions and unique grant keys enforce idempotency; versioned configuration preserves historical replay interpretation. All migrations are additive, never reset production.

Use `/play` and `/admin/play` within existing shells, plus authenticated `/api/play/*` and `/api/admin/play/*`. User profile gets a gaming summary link. Server decides seeds, expiry, accepted score and XP. Six deterministic engines share replay formats between browser and server; trivia competitive answers stay server-only.

## Security and delivery order

First complete the authorized Video Factory / Workers AI work. Then implement PLAY foundation, Tower and persistent verified results; remaining games; achievements and rankings; competitions and reviewed rewards; optional billable AI; security/localization/mobile tests. Free gameplay never spends AI credits. No paid-entry prize collection is enabled. Invalid replay, expired sessions, concurrent duplicate submissions, privacy and admin authorization require tests. No unimplemented control will be presented as operational.

## Current limitations

The implementation now includes six playable games, replay verification, persistent XP, reviewed trivia, user privacy, period rankings, daily/weekly free challenges and an audited tournament/reward workflow. See `play.md` for operation and verification details. This is not an implementation of paid-entry contests or a cosmetic-product shop. Browser automation is disabled in the local Work settings; automated engine/API/migration tests do not replace a visual device QA pass.
