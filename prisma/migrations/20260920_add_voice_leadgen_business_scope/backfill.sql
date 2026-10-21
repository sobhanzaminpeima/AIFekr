-- Stamp legacy rows with their owner's active business (idempotent).
UPDATE "VoiceAgent" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "VoiceAgent"."userId") WHERE "businessId" IS NULL;
UPDATE "VoiceKnowledgeBase" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "VoiceKnowledgeBase"."userId") WHERE "businessId" IS NULL;
UPDATE "VoiceCallLog" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "VoiceCallLog"."userId") WHERE "businessId" IS NULL;
UPDATE "VoiceAppointment" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "VoiceAppointment"."userId") WHERE "businessId" IS NULL;
UPDATE "LeadForm" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "LeadForm"."userId") WHERE "businessId" IS NULL;
UPDATE "LeadSource" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "LeadSource"."userId") WHERE "businessId" IS NULL;
