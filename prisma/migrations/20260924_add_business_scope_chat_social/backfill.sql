-- Stamp existing rows with their owner's active business (idempotent; a NULL activeBusinessId leaves the row NULL, meaning it stays visible under the additive "no business = show everywhere" rule).
UPDATE "Conversation" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "Conversation"."userId") WHERE "businessId" IS NULL;
UPDATE "ScheduledPost" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "ScheduledPost"."userId") WHERE "businessId" IS NULL;
UPDATE "InstagramConnection" SET "businessId" = (SELECT "activeBusinessId" FROM "User" WHERE "User"."id" = "InstagramConnection"."userId") WHERE "businessId" IS NULL;
