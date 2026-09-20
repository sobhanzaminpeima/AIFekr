-- AlterTable
ALTER TABLE "ContentPipelineRun" ADD COLUMN "planId" TEXT;

-- CreateTable
CREATE TABLE "SeoContentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "brandVoice" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'fa',
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "mode" TEXT NOT NULL DEFAULT 'draft',
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "runningSince" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeoContentPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SeoSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoContentPlan_siteId_key" ON "SeoContentPlan"("siteId");

-- CreateIndex
CREATE INDEX "SeoContentPlan_enabled_nextRunAt_idx" ON "SeoContentPlan"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "SeoContentPlan_userId_idx" ON "SeoContentPlan"("userId");

-- CreateIndex
CREATE INDEX "ContentPipelineRun_planId_idx" ON "ContentPipelineRun"("planId");

