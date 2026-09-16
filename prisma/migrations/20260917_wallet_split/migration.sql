-- Phase 2 of the monetization overhaul: split the single credits pool into
-- three wallets (AI chat / media generation / voice minutes). Columns are
-- nullable-default 0, existing balance is untouched here -- the proportional
-- backfill into these wallets is a separate script
-- (scripts/split-credits-into-wallets.js), run once right after this migration.
ALTER TABLE "User" ADD COLUMN "aiCredits" REAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mediaCredits" REAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "voiceMinutes" REAL NOT NULL DEFAULT 0;

ALTER TABLE "Team" ADD COLUMN "aiCredits" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "mediaCredits" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "voiceMinutes" REAL NOT NULL DEFAULT 0;
