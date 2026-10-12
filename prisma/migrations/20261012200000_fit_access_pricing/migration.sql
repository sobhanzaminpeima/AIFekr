-- Add independent admin-granted FIT entitlement and athlete preferences.
ALTER TABLE "User" ADD COLUMN "fitnessAccessExpiry" DATETIME;
ALTER TABLE "FitnessProfile" ADD COLUMN "preferredProgramId" TEXT;
ALTER TABLE "FitnessProfile" ADD COLUMN "selectedCoachId" TEXT;
-- New advertised prices apply to future quotes, never historic payments.
UPDATE Package SET priceUsd=12900,termPrices='{"monthly":12900,"quarterly":32900,"semiannual":59900}',isFeatured=1 WHERE planCode='TEAM_BUSINESS_GROW';
UPDATE Package SET priceUsd=14900,termPrices='{"monthly":14900,"quarterly":34900,"semiannual":64900}' WHERE planCode='TEAM_BUSINESS_SCALE';
UPDATE Package SET priceTry=119999,termPrices='{"monthly":119999,"quarterly":279999}' WHERE planCode='STUDENT_MONTHLY';
UPDATE Package SET priceUsd=4999,termPrices='{"monthly":4999,"quarterly":13499,"semiannual":23999}' WHERE planCode='FIT_MONTHLY';
UPDATE Package SET priceTry=279999 WHERE planCode='STUDENT_QUARTERLY';
