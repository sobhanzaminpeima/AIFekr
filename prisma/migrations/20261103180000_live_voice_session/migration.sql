-- AIFekr Live live-mode sessions. Additive: a new table only.
-- CreateTable
CREATE TABLE "LiveVoiceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "freeMinute" BOOLEAN NOT NULL DEFAULT false,
    "creditsPerMinute" INTEGER NOT NULL,
    "maxSeconds" INTEGER NOT NULL,
    "chargedMinutes" INTEGER NOT NULL DEFAULT 0,
    "chargedCredits" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER,
    "endReason" TEXT,
    "meteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveVoiceSession_providerSessionId_key" ON "LiveVoiceSession"("providerSessionId");

-- CreateIndex
CREATE INDEX "LiveVoiceSession_userId_status_idx" ON "LiveVoiceSession"("userId", "status");

-- CreateIndex
CREATE INDEX "LiveVoiceSession_status_meteredAt_idx" ON "LiveVoiceSession"("status", "meteredAt");
