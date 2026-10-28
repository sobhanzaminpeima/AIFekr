-- CreateTable
CREATE TABLE "GrowthProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "firstTouchId" TEXT,
    "lastTouchId" TEXT,
    "attributionConfidence" TEXT NOT NULL DEFAULT 'unknown',
    "intendedModule" TEXT,
    "objective" TEXT,
    "persona" TEXT,
    "intent" TEXT,
    "onboardingState" TEXT NOT NULL DEFAULT 'not_started',
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" DATETIME,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" DATETIME,
    "consentSource" TEXT,
    "unsubscribedAt" DATETIME,
    "assignedAdminId" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GrowthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrowthEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "anonId" TEXT,
    "name" TEXT NOT NULL,
    "moduleId" TEXT,
    "touchId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'server',
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrowthTouch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anonId" TEXT NOT NULL,
    "userId" TEXT,
    "campaignId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrerHost" TEXT,
    "landingPath" TEXT NOT NULL,
    "targetModule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthTouch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GrowthTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrowthCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "targetModule" TEXT,
    "landingPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "spendToman" INTEGER,
    "recommendedPlan" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GrowthMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrowthNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GrowthProfile_onboardingState_idx" ON "GrowthProfile"("onboardingState");

-- CreateIndex
CREATE INDEX "GrowthProfile_followUpStatus_idx" ON "GrowthProfile"("followUpStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthEvent_idempotencyKey_key" ON "GrowthEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GrowthEvent_userId_createdAt_idx" ON "GrowthEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthEvent_name_createdAt_idx" ON "GrowthEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthEvent_anonId_idx" ON "GrowthEvent"("anonId");

-- CreateIndex
CREATE INDEX "GrowthTouch_anonId_createdAt_idx" ON "GrowthTouch"("anonId", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthTouch_userId_createdAt_idx" ON "GrowthTouch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthTouch_campaignId_createdAt_idx" ON "GrowthTouch"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthTouch_utmCampaign_idx" ON "GrowthTouch"("utmCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthCampaign_utmCampaign_key" ON "GrowthCampaign"("utmCampaign");

-- CreateIndex
CREATE INDEX "GrowthCampaign_status_idx" ON "GrowthCampaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthMessage_idempotencyKey_key" ON "GrowthMessage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GrowthMessage_userId_createdAt_idx" ON "GrowthMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthMessage_ruleKey_createdAt_idx" ON "GrowthMessage"("ruleKey", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthNote_userId_createdAt_idx" ON "GrowthNote"("userId", "createdAt");

