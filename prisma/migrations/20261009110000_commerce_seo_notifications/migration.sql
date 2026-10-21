ALTER TABLE "User" ADD COLUMN "referralDiscountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SeoResearchJob" ADD COLUMN "notificationSentAt" DATETIME;
ALTER TABLE "SeoResearchJob" ADD COLUMN "notificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SeoResearchJob" ADD COLUMN "notificationError" TEXT;
ALTER TABLE "SeoResearchJob" ADD COLUMN "notificationClaimedAt" DATETIME;
ALTER TABLE "SeoResearchJob" ADD COLUMN "notificationCreatedAt" DATETIME;
-- Existing activities were not opted into email; notify only activities completed after deployment.
UPDATE "SeoResearchJob" SET "notificationSentAt" = CURRENT_TIMESTAMP WHERE "status" IN ('SUCCEEDED','FAILED');
ALTER TABLE "Payment" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "promoPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "originalAmount" INTEGER;
ALTER TABLE "Notification" ADD COLUMN "emailPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "emailSentAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "emailClaimedAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "emailError" TEXT;

-- Keep package prices/entitlements unchanged while making existing SEO access discoverable.
UPDATE "Package" SET
 "features" = "features" || char(10) || 'SEO Intelligence؛ داده‌های واقعی، رتبه و بک‌لینک (با اعتبار پکیج)',
 "featuresEn" = COALESCE("featuresEn", "features") || char(10) || 'SEO Intelligence: real data, rankings and backlinks (package credits)'
WHERE "planCode" IN ('TEAM_BUSINESS_START','TEAM_BUSINESS_GROW','TEAM_BUSINESS_SCALE','TEAM_STARTER','TEAM_GROWTH')
 AND instr(COALESCE("features",''),'SEO Intelligence') = 0;
