-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN "qualityNotes" TEXT;
ALTER TABLE "ScheduledPost" ADD COLUMN "qualityScore" INTEGER;

-- CreateTable
CREATE TABLE "LeadForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleDe" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionDe" TEXT,
    "fields" TEXT NOT NULL DEFAULT '{}',
    "accentColor" TEXT NOT NULL DEFAULT '#ea580c',
    "logoUrl" TEXT,
    "submitLabel" TEXT,
    "successMessage" TEXT,
    "redirectUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadFormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "contactId" TEXT,
    "data" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "tokenExpiry" DATETIME,
    "webhookKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "lastLeadAt" DATETIME,
    "leadsImported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialBrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pageType" TEXT,
    "specialty" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "contentPillars" TEXT,
    "avoidTopics" TEXT,
    "positioning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialBrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialCompetitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialCompetitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialCompetitorSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitorId" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followersCount" INTEGER NOT NULL,
    "mediaCount" INTEGER NOT NULL,
    "topPosts" TEXT NOT NULL,
    CONSTRAINT "SocialCompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "SocialCompetitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramCommentReplyLog" (
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
INSERT INTO "new_InstagramCommentReplyLog" ("campaignId", "commentId", "commenterId", "commenterUsername", "createdAt", "error", "id", "status", "userId") SELECT "campaignId", "commentId", "commenterId", "commenterUsername", "createdAt", "error", "id", "status", "userId" FROM "InstagramCommentReplyLog";
DROP TABLE "InstagramCommentReplyLog";
ALTER TABLE "new_InstagramCommentReplyLog" RENAME TO "InstagramCommentReplyLog";
CREATE UNIQUE INDEX "InstagramCommentReplyLog_commentId_key" ON "InstagramCommentReplyLog"("commentId");
CREATE INDEX "InstagramCommentReplyLog_campaignId_idx" ON "InstagramCommentReplyLog"("campaignId");
CREATE INDEX "InstagramCommentReplyLog_userId_createdAt_idx" ON "InstagramCommentReplyLog"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LeadForm_slug_key" ON "LeadForm"("slug");

-- CreateIndex
CREATE INDEX "LeadForm_userId_idx" ON "LeadForm"("userId");

-- CreateIndex
CREATE INDEX "LeadFormSubmission_formId_createdAt_idx" ON "LeadFormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadSource_userId_idx" ON "LeadSource"("userId");

-- CreateIndex
CREATE INDEX "LeadSource_provider_externalId_idx" ON "LeadSource"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_userId_provider_externalId_key" ON "LeadSource"("userId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialBrandProfile_userId_key" ON "SocialBrandProfile"("userId");

-- CreateIndex
CREATE INDEX "SocialCompetitor_userId_idx" ON "SocialCompetitor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCompetitor_userId_username_key" ON "SocialCompetitor"("userId", "username");

-- CreateIndex
CREATE INDEX "SocialCompetitorSnapshot_competitorId_takenAt_idx" ON "SocialCompetitorSnapshot"("competitorId", "takenAt");

