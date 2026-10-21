ALTER TABLE "StudentFlashcard" ADD COLUMN "masteryLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentFlashcard" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentFlashcard" ADD COLUMN "lastReviewedAt" DATETIME;
ALTER TABLE "StudentFlashcard" ADD COLUMN "nextReviewAt" DATETIME;
CREATE INDEX "StudentFlashcard_userId_nextReviewAt_idx" ON "StudentFlashcard"("userId", "nextReviewAt");
