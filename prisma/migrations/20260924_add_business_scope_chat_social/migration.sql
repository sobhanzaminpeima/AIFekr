-- Additive only: new nullable/defaulted columns and indexes. No table rebuild needed.
-- AlterTable
ALTER TABLE "BusinessWorkspace" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fa';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "businessId" TEXT;
CREATE INDEX "Conversation_businessId_idx" ON "Conversation"("businessId");

-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN "businessId" TEXT;
CREATE INDEX "ScheduledPost_businessId_idx" ON "ScheduledPost"("businessId");

-- AlterTable: InstagramConnection moves from one-per-user to one-per-(user,business).
ALTER TABLE "InstagramConnection" ADD COLUMN "businessId" TEXT;
DROP INDEX "InstagramConnection_userId_key";
CREATE INDEX "InstagramConnection_businessId_idx" ON "InstagramConnection"("businessId");
CREATE UNIQUE INDEX "InstagramConnection_userId_businessId_key" ON "InstagramConnection"("userId", "businessId");
