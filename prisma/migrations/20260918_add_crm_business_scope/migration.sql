-- CRM and real-estate records originally belonged to a single User workspace.
-- Keep the new boundary nullable during the transition so existing records can
-- be backfilled without data loss before application reads require it.
ALTER TABLE "CrmContact" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmPipeline" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmDeal" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmDocument" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmAutomationRule" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmActivity" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmTask" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmInsight" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmAnalysisRun" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmProduct" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmInvoice" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmContractTemplate" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmContract" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmNote" ADD COLUMN "businessId" TEXT;
ALTER TABLE "CrmProject" ADD COLUMN "businessId" TEXT;
ALTER TABLE "VoiceProperty" ADD COLUMN "businessId" TEXT;
ALTER TABLE "PropertyViewing" ADD COLUMN "businessId" TEXT;
ALTER TABLE "PropertyBooking" ADD COLUMN "businessId" TEXT;
ALTER TABLE "PropertyInterest" ADD COLUMN "businessId" TEXT;

CREATE INDEX "CrmContact_businessId_idx" ON "CrmContact"("businessId");
CREATE INDEX "CrmPipeline_businessId_idx" ON "CrmPipeline"("businessId");
CREATE INDEX "CrmDeal_businessId_idx" ON "CrmDeal"("businessId");
CREATE INDEX "CrmDocument_businessId_idx" ON "CrmDocument"("businessId");
CREATE INDEX "CrmAutomationRule_businessId_idx" ON "CrmAutomationRule"("businessId");
CREATE INDEX "CrmActivity_businessId_idx" ON "CrmActivity"("businessId");
CREATE INDEX "CrmTask_businessId_idx" ON "CrmTask"("businessId");
CREATE INDEX "CrmInsight_businessId_idx" ON "CrmInsight"("businessId");
CREATE INDEX "CrmAnalysisRun_businessId_createdAt_idx" ON "CrmAnalysisRun"("businessId", "createdAt");
CREATE INDEX "CrmProduct_businessId_idx" ON "CrmProduct"("businessId");
CREATE INDEX "CrmInvoice_businessId_idx" ON "CrmInvoice"("businessId");
CREATE INDEX "CrmContractTemplate_businessId_idx" ON "CrmContractTemplate"("businessId");
CREATE INDEX "CrmContract_businessId_idx" ON "CrmContract"("businessId");
CREATE INDEX "CrmNote_businessId_idx" ON "CrmNote"("businessId");
CREATE INDEX "CrmProject_businessId_idx" ON "CrmProject"("businessId");
CREATE INDEX "VoiceProperty_businessId_idx" ON "VoiceProperty"("businessId");
CREATE INDEX "PropertyViewing_businessId_idx" ON "PropertyViewing"("businessId");
CREATE INDEX "PropertyBooking_businessId_idx" ON "PropertyBooking"("businessId");
CREATE INDEX "PropertyInterest_businessId_idx" ON "PropertyInterest"("businessId");
