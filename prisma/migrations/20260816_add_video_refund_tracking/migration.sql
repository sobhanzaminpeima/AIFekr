-- Tracks whether a failed async video generation's up-front credit charge
-- has already been refunded, so the status-polling route never double-refunds.
ALTER TABLE "GeneratedVideo" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;
