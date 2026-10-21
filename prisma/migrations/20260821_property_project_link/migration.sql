-- Real-estate Projects (item 2, batch2): link Property to CrmProject and add
-- short-term-rental fields, following the same additive pattern as the
-- crmContactId/crmDealId link migration. Purely additive — no existing data
-- touched.

ALTER TABLE "VoiceProperty" ADD COLUMN "crmProjectId" TEXT;
ALTER TABLE "VoiceProperty" ADD COLUMN "nightlyPrice" BIGINT;
ALTER TABLE "VoiceProperty" ADD COLUMN "bookingLink" TEXT;

CREATE INDEX "VoiceProperty_crmProjectId_idx" ON "VoiceProperty"("crmProjectId");
