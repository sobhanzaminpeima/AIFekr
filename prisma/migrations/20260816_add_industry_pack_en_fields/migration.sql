-- Add nullable English-translation columns to IndustryPack so the /industry
-- pages can show real English content instead of falling back to Persian.
ALTER TABLE "IndustryPack" ADD COLUMN "valuePropositionEn" TEXT;
ALTER TABLE "IndustryPack" ADD COLUMN "targetCustomersEn" TEXT;
ALTER TABLE "IndustryPack" ADD COLUMN "painPointsEn" TEXT;
ALTER TABLE "IndustryPack" ADD COLUMN "agentsEn" TEXT;
ALTER TABLE "IndustryPack" ADD COLUMN "outcomesEn" TEXT;
ALTER TABLE "IndustryPack" ADD COLUMN "kpisEn" TEXT;
