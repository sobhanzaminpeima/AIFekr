-- Add workspace isolation to the existing comment-to-DM feature.
ALTER TABLE "InstagramCommentCampaign" ADD COLUMN "businessId" TEXT;
ALTER TABLE "InstagramCommentReplyLog" ADD COLUMN "businessId" TEXT;
ALTER TABLE "InstagramFollowerSnapshot" ADD COLUMN "businessId" TEXT;
DROP INDEX "InstagramFollowerSnapshot_userId_date_key";
CREATE UNIQUE INDEX "InstagramFollowerSnapshot_userId_businessId_date_key" ON "InstagramFollowerSnapshot"("userId", "businessId", "date");
CREATE INDEX "InstagramFollowerSnapshot_businessId_date_idx" ON "InstagramFollowerSnapshot"("businessId", "date");

-- Preserve existing rows when a user has one unambiguous Instagram workspace.
UPDATE "InstagramCommentCampaign"
SET "businessId" = (SELECT "businessId" FROM "InstagramConnection" WHERE "userId" = "InstagramCommentCampaign"."userId" LIMIT 1)
WHERE "businessId" IS NULL AND (SELECT COUNT(*) FROM "InstagramConnection" WHERE "userId" = "InstagramCommentCampaign"."userId") = 1;
UPDATE "InstagramCommentReplyLog"
SET "businessId" = (SELECT "businessId" FROM "InstagramConnection" WHERE "userId" = "InstagramCommentReplyLog"."userId" LIMIT 1)
WHERE "businessId" IS NULL AND (SELECT COUNT(*) FROM "InstagramConnection" WHERE "userId" = "InstagramCommentReplyLog"."userId") = 1;
UPDATE "InstagramFollowerSnapshot"
SET "businessId" = (SELECT "businessId" FROM "InstagramConnection" WHERE "userId" = "InstagramFollowerSnapshot"."userId" LIMIT 1)
WHERE "businessId" IS NULL AND (SELECT COUNT(*) FROM "InstagramConnection" WHERE "userId" = "InstagramFollowerSnapshot"."userId") = 1;
CREATE INDEX "InstagramCommentCampaign_businessId_idx" ON "InstagramCommentCampaign"("businessId");
CREATE INDEX "InstagramCommentCampaign_userId_businessId_idx" ON "InstagramCommentCampaign"("userId", "businessId");
CREATE INDEX "InstagramCommentReplyLog_businessId_createdAt_idx" ON "InstagramCommentReplyLog"("businessId", "createdAt");

-- Native Auto Direct rules and event ledger. Kept additive for safe deployment.
CREATE TABLE "InstagramDirectRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "name" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL DEFAULT 'keyword',
  "keywords" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "triggerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "InstagramDirectRule_userId_businessId_idx" ON "InstagramDirectRule"("userId", "businessId");
CREATE INDEX "InstagramDirectRule_businessId_isActive_idx" ON "InstagramDirectRule"("businessId", "isActive");

CREATE TABLE "InstagramDirectMessageLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "ruleId" TEXT,
  "eventId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "text" TEXT,
  "status" TEXT NOT NULL DEFAULT 'received',
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InstagramDirectMessageLog_eventId_key" ON "InstagramDirectMessageLog"("eventId");
CREATE INDEX "InstagramDirectMessageLog_userId_businessId_createdAt_idx" ON "InstagramDirectMessageLog"("userId", "businessId", "createdAt");
CREATE INDEX "InstagramDirectMessageLog_ruleId_idx" ON "InstagramDirectMessageLog"("ruleId");
