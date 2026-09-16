-- Phase 1 of the monetization overhaul: real per-request cost tracking.
-- UsageLog gains provider/token-split/media-seconds/cost columns (all
-- nullable -- existing rows and existing writers keep working unchanged).
ALTER TABLE "UsageLog" ADD COLUMN "provider" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "UsageLog" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "UsageLog" ADD COLUMN "cachedTokens" INTEGER;
ALTER TABLE "UsageLog" ADD COLUMN "mediaSeconds" REAL;
ALTER TABLE "UsageLog" ADD COLUMN "voiceSeconds" REAL;
ALTER TABLE "UsageLog" ADD COLUMN "estimatedCostUsd" REAL;
ALTER TABLE "UsageLog" ADD COLUMN "actualCostUsd" REAL;
ALTER TABLE "UsageLog" ADD COLUMN "requestId" TEXT;

CREATE INDEX "UsageLog_provider_idx" ON "UsageLog"("provider");

-- Admin-editable $ pricing per provider+kind (see AiModelPricing's schema
-- comment for why this is intentionally NOT a full provider/model registry).
CREATE TABLE "AiModelPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputPricePerMillion" REAL,
    "outputPricePerMillion" REAL,
    "pricePerUnit" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AiModelPricing_providerId_kind_key" ON "AiModelPricing"("providerId", "kind");
