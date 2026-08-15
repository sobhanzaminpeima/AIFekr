-- Hand-written (not `prisma migrate diff` output) — same reasoning as the
-- prior CRM migrations: plain ALTER TABLE ADD COLUMN (nullable) never
-- triggers SQLite's DROP+CREATE+re-INSERT table rewrite.

ALTER TABLE "ScheduledPost" ADD COLUMN "videoUrl" TEXT;
