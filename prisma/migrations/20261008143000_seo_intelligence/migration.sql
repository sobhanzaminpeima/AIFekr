ALTER TABLE "SeoSite" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "SeoSite" ADD COLUMN "verifiedAt" DATETIME;
CREATE TABLE "SeoResearchJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "siteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "organizationId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "input" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "result" TEXT,
  "errorCode" TEXT,
  "credits" INTEGER NOT NULL,
  "estimatedCostUsd" REAL NOT NULL,
  "actualCostUsd" REAL,
  "providerTaskId" TEXT,
  "payerTeamId" TEXT,
  "mirroredAi" INTEGER NOT NULL,
  "usageLogId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "refundedAt" DATETIME,
  CONSTRAINT "SeoResearchJob_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeoResearchJob_userId_idempotencyKey_key" ON "SeoResearchJob"("userId", "idempotencyKey");
CREATE INDEX "SeoResearchJob_businessId_createdAt_idx" ON "SeoResearchJob"("businessId", "createdAt");
CREATE INDEX "SeoResearchJob_siteId_createdAt_idx" ON "SeoResearchJob"("siteId", "createdAt");
CREATE INDEX "SeoResearchJob_status_expiresAt_idx" ON "SeoResearchJob"("status", "expiresAt");
