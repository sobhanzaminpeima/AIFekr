-- Generalize VoiceProperty into the reusable "Property" extension-record
-- pattern, optionally linked into CRM. Purely additive — the physical table
-- name stays "VoiceProperty" (Prisma model renamed to Property via @@map,
-- no data touched), so existing voice-agent property/appointment data is
-- unaffected.

ALTER TABLE "VoiceProperty" ADD COLUMN "crmContactId" TEXT;
ALTER TABLE "VoiceProperty" ADD COLUMN "crmDealId" TEXT;

CREATE INDEX "VoiceProperty_crmContactId_idx" ON "VoiceProperty"("crmContactId");
CREATE INDEX "VoiceProperty_crmDealId_idx" ON "VoiceProperty"("crmDealId");
