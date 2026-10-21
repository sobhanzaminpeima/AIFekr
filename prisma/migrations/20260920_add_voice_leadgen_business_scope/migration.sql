-- AlterTable
ALTER TABLE "VoiceAgent" ADD COLUMN "businessId" TEXT;

-- AlterTable
ALTER TABLE "VoiceKnowledgeBase" ADD COLUMN "businessId" TEXT;

-- AlterTable
ALTER TABLE "VoiceCallLog" ADD COLUMN "businessId" TEXT;

-- AlterTable
ALTER TABLE "VoiceAppointment" ADD COLUMN "businessId" TEXT;

-- AlterTable
ALTER TABLE "LeadForm" ADD COLUMN "businessId" TEXT;

-- AlterTable
ALTER TABLE "LeadSource" ADD COLUMN "businessId" TEXT;

-- CreateIndex
CREATE INDEX "VoiceAgent_businessId_idx" ON "VoiceAgent"("businessId");

-- CreateIndex
CREATE INDEX "VoiceKnowledgeBase_businessId_idx" ON "VoiceKnowledgeBase"("businessId");

-- CreateIndex
CREATE INDEX "VoiceCallLog_businessId_idx" ON "VoiceCallLog"("businessId");

-- CreateIndex
CREATE INDEX "VoiceAppointment_businessId_idx" ON "VoiceAppointment"("businessId");

-- CreateIndex
CREATE INDEX "LeadForm_businessId_idx" ON "LeadForm"("businessId");

-- CreateIndex
CREATE INDEX "LeadSource_businessId_idx" ON "LeadSource"("businessId");

