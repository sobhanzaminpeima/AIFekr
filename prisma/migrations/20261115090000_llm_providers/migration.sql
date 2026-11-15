-- Dynamic LLM providers (Coarena first): providers, synced models, unified usage ledger,
-- provider-reported usage snapshots and day counters for internal caps. Additive only.
-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "keyHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthAt" DATETIME,
    "lastSyncAt" DATETIME,
    "lastSyncError" TEXT,
    "lastError" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "defaultModelId" TEXT,
    "defaultCreditCost" INTEGER NOT NULL DEFAULT 3,
    "dailyRequestCap" INTEGER,
    "perUserDailyCap" INTEGER,
    "maxOutputTokens" INTEGER,
    "maxConcurrency" INTEGER,
    "softWarnPercent" INTEGER NOT NULL DEFAULT 80,
    "hardStopPercent" INTEGER NOT NULL DEFAULT 100,
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoRouting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LlmProviderModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lifecycle" TEXT,
    "vision" BOOLEAN NOT NULL DEFAULT false,
    "streaming" BOOLEAN NOT NULL DEFAULT true,
    "tools" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "creditCost" INTEGER,
    "dailyRequestCap" INTEGER,
    "metadata" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LlmProviderModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LlmUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "userId" TEXT,
    "upstreamRequestId" TEXT,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "reportedCostUsd" REAL,
    "estimatedCostUsd" REAL,
    "latencyMs" INTEGER,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "errorCategory" TEXT,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "LlmProviderSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creditRemainingUsd" REAL,
    "usedTodayUsd" REAL,
    "dailyLimitUsd" REAL,
    "requestsToday" INTEGER,
    "requestsLeft" INTEGER,
    "dailyRequestLimit" INTEGER,
    "resetAt" DATETIME,
    "data" TEXT,
    "error" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LlmUsageCounter" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "LlmProviderModel_providerId_enabled_idx" ON "LlmProviderModel"("providerId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "LlmProviderModel_providerId_externalId_key" ON "LlmProviderModel"("providerId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LlmUsageEvent_requestId_key" ON "LlmUsageEvent"("requestId");

-- CreateIndex
CREATE INDEX "LlmUsageEvent_providerId_startedAt_idx" ON "LlmUsageEvent"("providerId", "startedAt");

-- CreateIndex
CREATE INDEX "LlmUsageEvent_modelId_startedAt_idx" ON "LlmUsageEvent"("modelId", "startedAt");

-- CreateIndex
CREATE INDEX "LlmUsageEvent_userId_startedAt_idx" ON "LlmUsageEvent"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "LlmProviderSnapshot_providerId_fetchedAt_idx" ON "LlmProviderSnapshot"("providerId", "fetchedAt");
