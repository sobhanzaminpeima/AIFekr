# AIFekr PLAY

PLAY uses existing account/session authentication, the dashboard shell, SQLite/Prisma and admin authorization. `/play` contains Tower, Snake Rush, 2048 Battle, Speed Run, FIKO Fly and Brain Challenge. `/admin/play` manages lifecycle, independent game status, versioned speed/score rules, suspended players, reviewed question publication, free tournaments and reward fulfillment.

## Integrity and accounting

The server issues seeds and snapshots rules. Arcade results contain ordered inputs and fixed 50ms frames, never a trusted score. The server resimulates inputs, checks session ownership, expiration and elapsed time. A unique XP ledger entry prevents duplicate awards. XP is `min(100, floor(score / 10))`; level is `floor(sqrt(XP / 100)) + 1`. Neither points nor XP modify AI credits or money. This limits forged results but cannot prove a human played; a deterministic game can be automated. Prize winners still require admin review.

Competitions have free entry only, common seeds, frozen rules, bounded attempts and capacity. Highest accepted score per player wins; ties use earliest completion then session ID. Closing snapshots results; approval and fulfillment are separate audited operations with notifications. Daily/weekly UTC challenges are created lazily and have no cash prize. Brain competitions are blocked until a fixed, reviewed multilingual bank version is available.

## Routes

- `GET /api/play`: own statistics, personal records, history, achievements and privacy-filtered rankings.
- `POST /api/play/sessions`: start, abandon or verify a session.
- `POST /api/play/brain`: server-checked timed questions.
- `POST /api/play/profile`: leaderboard name visibility; private by default.
- `GET /api/play/leaderboard`: daily/weekly/monthly/all-time, optional game filter; periods use UTC.
- `GET /api/play/competitions`: published competitions and own rewards.
- `GET/POST /api/admin/play`: admin lifecycle, games, players, questions and audit.
- `GET/POST /api/admin/play/competitions`: competition and reward control.
- `POST /api/admin/play/questions/generate`: bounded Cloudflare drafts; always DRAFT until a human reviews and publishes. Admin API cost is shown before invocation. No generation is needed for normal gameplay.

## Deployment and verification

Back up the existing database, apply additive migration `20261020150000_play_foundation`, regenerate Prisma, then run `node scripts/install-play.cjs`. Installation is idempotent and preserves existing game/admin settings. It installs a reviewed arithmetic bank in fa/en/de/tr. Build locally and deploy a versioned release, preview health/auth before switching PM2 and retain rollback. Do not reset the database.

Run `npx vitest run src/lib/play src/lib/seo/localeRewrite.test.ts`, `npx tsc --noEmit`, scoped ESLint and `npm run build`. Integration tests use isolated SQLite, apply the actual migration, verify XP idempotency, ownership, privacy, trivia replay rejection and tournament closing/approval/fulfillment. Engine tests cover all five arcade simulations and server trivia covers the sixth game.

## Limits

No paid-entry contests, cash wallet, cosmetic checkout, multi-game sponsored season, historical ranking-change chart, friends graph or post-game paid AI coach is shipped. Current AI integration is admin-reviewed question drafting. Device visual QA remains required because local browser control is disabled. Games pause when backgrounded; a page reload starts a new game rather than restoring an unfinished replay. Shared result cards are social images, not proof of a public record.
