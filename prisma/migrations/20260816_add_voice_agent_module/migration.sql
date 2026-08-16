-- AlterTable
ALTER TABLE "User" ADD COLUMN "voicePlan" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "voicePlanExpiry" DATETIME;

-- CreateTable
CREATE TABLE "VoiceAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "focus" TEXT NOT NULL DEFAULT 'general',
    "systemPrompt" TEXT NOT NULL,
    "voiceId" TEXT,
    "phoneNumber" TEXT,
    "vapiAssistantId" TEXT,
    "vapiPhoneNumberId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "listingType" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'apartment',
    "price" BIGINT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" INTEGER,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "vapiCallId" TEXT,
    "callerPhone" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "outcome" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "durationSec" INTEGER,
    "recordingUrl" TEXT,
    "cost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "VoiceCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCallLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceAppointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "propertyId" TEXT,
    "callLogId" TEXT,
    "leadName" TEXT,
    "leadPhone" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceAppointment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceAppointment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoiceAppointment_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "VoiceCallLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VoiceAgent_userId_idx" ON "VoiceAgent"("userId");

-- CreateIndex
CREATE INDEX "VoiceProperty_userId_idx" ON "VoiceProperty"("userId");

-- CreateIndex
CREATE INDEX "VoiceProperty_agentId_idx" ON "VoiceProperty"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallLog_vapiCallId_key" ON "VoiceCallLog"("vapiCallId");

-- CreateIndex
CREATE INDEX "VoiceCallLog_userId_idx" ON "VoiceCallLog"("userId");

-- CreateIndex
CREATE INDEX "VoiceCallLog_agentId_idx" ON "VoiceCallLog"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceAppointment_callLogId_key" ON "VoiceAppointment"("callLogId");

-- CreateIndex
CREATE INDEX "VoiceAppointment_userId_idx" ON "VoiceAppointment"("userId");

-- CreateIndex
CREATE INDEX "VoiceAppointment_agentId_idx" ON "VoiceAppointment"("agentId");

-- CreateTable
CREATE TABLE "VoiceKnowledgeBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceKnowledgeBase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceKnowledgeBase_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VoiceKnowledgeBase_userId_idx" ON "VoiceKnowledgeBase"("userId");

-- CreateIndex
CREATE INDEX "VoiceKnowledgeBase_agentId_idx" ON "VoiceKnowledgeBase"("agentId");
