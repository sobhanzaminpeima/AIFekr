-- AlterTable
ALTER TABLE "VideoFactoryStep" ADD COLUMN "costUsd" REAL;
ALTER TABLE "VideoFactoryStep" ADD COLUMN "latencyMs" INTEGER;
ALTER TABLE "VideoFactoryStep" ADD COLUMN "promptVersion" INTEGER;
ALTER TABLE "VideoFactoryStep" ADD COLUMN "providerJobId" TEXT;
ALTER TABLE "VideoFactoryStep" ADD COLUMN "usage" TEXT;

-- CreateTable
CREATE TABLE "VideoFactoryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "shotId" TEXT,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFactoryAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryStorageQuota" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "usedBytes" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoFactoryProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secret" TEXT,
    "credentialRef" TEXT,
    "settings" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "circuitUntil" DATETIME,
    "health" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "checkedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoFactoryResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoFactoryConfigVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configuration" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VideoFactoryApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFactoryApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryQualityReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "shotId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VideoFactoryPublishJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" DATETIME NOT NULL,
    "authorizedAt" DATETIME NOT NULL,
    "metadata" TEXT NOT NULL,
    "uploadUrl" TEXT,
    "uploadedBytes" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" DATETIME,
    "providerId" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoFactoryPublishJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryChannel" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoFactoryWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerJobId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoFactoryProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "manifest" TEXT NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "activeJobId" TEXT,
    "research" TEXT NOT NULL DEFAULT '[]',
    "publishing" TEXT NOT NULL DEFAULT '{}',
    "planning" TEXT NOT NULL DEFAULT '{}',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoFactoryProject" ("activeJobId", "brief", "configuration", "createdAt", "id", "manifest", "title", "updatedAt", "userId", "version") SELECT "activeJobId", "brief", "configuration", "createdAt", "id", "manifest", "title", "updatedAt", "userId", "version" FROM "VideoFactoryProject";
DROP TABLE "VideoFactoryProject";
ALTER TABLE "new_VideoFactoryProject" RENAME TO "VideoFactoryProject";
CREATE INDEX "VideoFactoryProject_userId_updatedAt_idx" ON "VideoFactoryProject"("userId", "updatedAt");
CREATE TABLE "new_VideoFactoryJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'SCRIPTING',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" TEXT NOT NULL DEFAULT '{}',
    "policy" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "spentCredits" INTEGER NOT NULL DEFAULT 0,
    "usageLogId" TEXT NOT NULL,
    "payerTeamId" TEXT,
    "mirroredAi" REAL NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" DATETIME,
    "errorCode" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "actualCostUsd" REAL,
    "storageBytes" REAL NOT NULL DEFAULT 0,
    "sourceJobId" TEXT,
    "plan" TEXT NOT NULL DEFAULT '{}',
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoFactoryJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_VideoFactoryJob" ("checkpoint", "createdAt", "credits", "cursor", "errorCode", "id", "idempotencyKey", "leaseToken", "leaseUntil", "mirroredAi", "payerTeamId", "policy", "projectId", "projectVersion", "requestHash", "settledAt", "spentCredits", "stage", "status", "updatedAt", "usageLogId", "userId") SELECT "checkpoint", "createdAt", "credits", "cursor", "errorCode", "id", "idempotencyKey", "leaseToken", "leaseUntil", "mirroredAi", "payerTeamId", "policy", "projectId", "projectVersion", "requestHash", "settledAt", "spentCredits", "stage", "status", "updatedAt", "usageLogId", "userId" FROM "VideoFactoryJob";
DROP TABLE "VideoFactoryJob";
ALTER TABLE "new_VideoFactoryJob" RENAME TO "VideoFactoryJob";
CREATE UNIQUE INDEX "VideoFactoryJob_usageLogId_key" ON "VideoFactoryJob"("usageLogId");
CREATE INDEX "VideoFactoryJob_status_leaseUntil_createdAt_idx" ON "VideoFactoryJob"("status", "leaseUntil", "createdAt");
CREATE INDEX "VideoFactoryJob_projectId_createdAt_idx" ON "VideoFactoryJob"("projectId", "createdAt");
CREATE UNIQUE INDEX "VideoFactoryJob_userId_idempotencyKey_key" ON "VideoFactoryJob"("userId", "idempotencyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VideoFactoryAsset_userId_kind_createdAt_idx" ON "VideoFactoryAsset"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "VideoFactoryAsset_projectId_status_idx" ON "VideoFactoryAsset"("projectId", "status");

-- CreateIndex
CREATE INDEX "VideoFactoryAsset_jobId_shotId_kind_idx" ON "VideoFactoryAsset"("jobId", "shotId", "kind");

-- CreateIndex
CREATE INDEX "VideoFactoryProvider_kind_enabled_idx" ON "VideoFactoryProvider"("kind", "enabled");

-- CreateIndex
CREATE INDEX "VideoFactoryResource_kind_enabled_idx" ON "VideoFactoryResource"("kind", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryConfigVersion_resourceId_kind_version_key" ON "VideoFactoryConfigVersion"("resourceId", "kind", "version");

-- CreateIndex
CREATE INDEX "VideoFactoryApproval_projectId_createdAt_idx" ON "VideoFactoryApproval"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoFactoryQualityReport_jobId_createdAt_idx" ON "VideoFactoryQualityReport"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoFactoryQualityReport_kind_status_idx" ON "VideoFactoryQualityReport"("kind", "status");

-- CreateIndex
CREATE INDEX "VideoFactoryPublishJob_status_scheduledAt_idx" ON "VideoFactoryPublishJob"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryPublishJob_userId_idempotencyKey_key" ON "VideoFactoryPublishJob"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "VideoFactoryWebhookEvent_createdAt_idx" ON "VideoFactoryWebhookEvent"("createdAt");
