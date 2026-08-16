-- Voice Agent: generalize beyond real estate + link calls to CRM contacts

-- 1. VoiceAgent.vertical — "real_estate" | "general", controls which Vapi
--    tool set gets registered for this agent.
ALTER TABLE "VoiceAgent" ADD COLUMN "vertical" TEXT NOT NULL DEFAULT 'real_estate';

-- 2. VoiceCallLog.contactId — best-effort link to a CrmContact matched by
--    phone number. Nullable, no default, SetNull on delete.
ALTER TABLE "VoiceCallLog" ADD COLUMN "contactId" TEXT;

CREATE INDEX "VoiceCallLog_contactId_idx" ON "VoiceCallLog"("contactId");
