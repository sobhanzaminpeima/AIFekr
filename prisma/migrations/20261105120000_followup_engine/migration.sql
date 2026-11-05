-- Smart follow-up engine: job queue and per-channel suppression. Additive: two new tables only.
-- CreateTable
CREATE TABLE "FollowupJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'treatment',
    "campaignKey" TEXT,
    "scheduledFor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "lastError" TEXT,
    "claimedAt" DATETIME,
    "processedAt" DATETIME,
    "sentAt" DATETIME,
    "notificationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowupJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowupSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowupSuppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowupJob_idempotencyKey_key" ON "FollowupJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FollowupJob_status_nextAttemptAt_idx" ON "FollowupJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FollowupJob_userId_sentAt_idx" ON "FollowupJob"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "FollowupJob_ruleKey_status_idx" ON "FollowupJob"("ruleKey", "status");

-- CreateIndex
CREATE INDEX "FollowupJob_createdAt_idx" ON "FollowupJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowupSuppression_userId_channel_key" ON "FollowupSuppression"("userId", "channel");
