-- Scheduler retry (roadmap E8). Additive: one new column with a default.
ALTER TABLE "ScheduledPost" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
