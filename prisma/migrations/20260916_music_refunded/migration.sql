-- Music generation charged up-front like video, but had no `refunded` flag
-- and no refund path, so a failed async Replicate job silently kept the
-- user's credits. Mirrors GeneratedVideo.refunded so status polling can
-- refund exactly once.

ALTER TABLE "GeneratedMusic" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;
