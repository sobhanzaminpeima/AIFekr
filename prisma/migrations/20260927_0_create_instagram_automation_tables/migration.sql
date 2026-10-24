-- InstagramCommentCampaign, InstagramCommentReplyLog, InstagramFollowerSnapshot were first created with `prisma db push` and never got a migration,
-- so a database built from migrations alone failed at 20260927_add_instagram_auto_direct_saas.
-- Recreated here in their pre-20260927_add_instagram_auto_direct_saas shape; IF NOT EXISTS keeps this a
-- no-op on databases that already have them.
CREATE TABLE IF NOT EXISTS "InstagramCommentCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "postId" TEXT,
    "dmMessage" TEXT NOT NULL,
    "publicReplyMessage" TEXT,
    "links" TEXT,
    "followGateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "followGatePrompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "InstagramCommentCampaign_userId_idx" ON "InstagramCommentCampaign"("userId");
CREATE TABLE IF NOT EXISTS "InstagramCommentReplyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "userId" TEXT,
    "commentId" TEXT NOT NULL,
    "commenterId" TEXT NOT NULL,
    "commenterUsername" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramCommentReplyLog_commentId_key" ON "InstagramCommentReplyLog"("commentId");
CREATE INDEX IF NOT EXISTS "InstagramCommentReplyLog_campaignId_idx" ON "InstagramCommentReplyLog"("campaignId");
CREATE INDEX IF NOT EXISTS "InstagramCommentReplyLog_userId_createdAt_idx" ON "InstagramCommentReplyLog"("userId", "createdAt");
CREATE TABLE IF NOT EXISTS "InstagramFollowerSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "followersCount" INTEGER NOT NULL,
    "mediaCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "InstagramFollowerSnapshot_userId_idx" ON "InstagramFollowerSnapshot"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramFollowerSnapshot_userId_date_key" ON "InstagramFollowerSnapshot"("userId", "date");
