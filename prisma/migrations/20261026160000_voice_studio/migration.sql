CREATE TABLE "VoiceStudioProject" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "businessId" TEXT,
 "name" TEXT NOT NULL, "text" TEXT NOT NULL DEFAULT '', "language" TEXT NOT NULL DEFAULT 'fa',
 "archivedAt" DATETIME, "deletedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "VoiceStudioGeneration" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "businessId" TEXT,
 "projectId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "inputHash" TEXT NOT NULL,
 "text" TEXT NOT NULL, "graphemes" INTEGER NOT NULL, "providerCharacters" INTEGER NOT NULL,
 "billedCharacters" INTEGER, "segmentIndex" INTEGER NOT NULL, "language" TEXT NOT NULL,
 "voiceId" TEXT NOT NULL, "modelId" TEXT NOT NULL, "voiceSettings" TEXT NOT NULL DEFAULT '{}',
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "pricingSnapshot" TEXT NOT NULL,
 "estimatedSeconds" REAL NOT NULL, "reservedCredits" INTEGER NOT NULL,
 "chargedCredits" INTEGER NOT NULL DEFAULT 0, "refundedCredits" INTEGER NOT NULL DEFAULT 0,
 "usageLogId" TEXT NOT NULL, "payerTeamId" TEXT, "mirroredAi" INTEGER NOT NULL DEFAULT 0,
 "providerRequestId" TEXT, "providerStartedAt" DATETIME, "providerCostUsd" REAL,
 "durationMs" INTEGER, "storageKey" TEXT, "bytes" INTEGER, "waveform" TEXT, "errorCode" TEXT,
 "attempts" INTEGER NOT NULL DEFAULT 0, "startedAt" DATETIME, "completedAt" DATETIME,
 "expiresAt" DATETIME, "deletedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "VoiceStudioGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VoiceStudioProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "VoiceStudioProject_userId_businessId_updatedAt_idx" ON "VoiceStudioProject"("userId", "businessId", "updatedAt");
CREATE INDEX "VoiceStudioGeneration_status_createdAt_idx" ON "VoiceStudioGeneration"("status", "createdAt");
CREATE INDEX "VoiceStudioGeneration_userId_businessId_projectId_idx" ON "VoiceStudioGeneration"("userId", "businessId", "projectId");
CREATE UNIQUE INDEX "VoiceStudioGeneration_userId_idempotencyKey_key" ON "VoiceStudioGeneration"("userId", "idempotencyKey");
