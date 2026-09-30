-- Add configurable, bounded delivery options for native Auto Direct.
ALTER TABLE "InstagramDirectRule" ADD COLUMN "followGateEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstagramDirectRule" ADD COLUMN "typingIndicatorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstagramDirectRule" ADD COLUMN "delayMinSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InstagramDirectRule" ADD COLUMN "delayMaxSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InstagramDirectMessageLog" ADD COLUMN "replyText" TEXT;
