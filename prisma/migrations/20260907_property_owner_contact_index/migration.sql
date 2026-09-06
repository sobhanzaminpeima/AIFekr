-- ownerContactId existed as a plain column with no index and no Prisma
-- relation; adding the relation (see schema.prisma) needs no column change,
-- but the new index matches the pattern already used for every other FK-like
-- column on this table (crmContactId, crmDealId, crmProjectId).
CREATE INDEX IF NOT EXISTS "VoiceProperty_ownerContactId_idx" ON "VoiceProperty"("ownerContactId");
