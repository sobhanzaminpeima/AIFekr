-- Access-control core for the real-estate CRM/agent gating system (Phase 1).
-- Two new tables, purely additive, no existing data touched:
--   IndustryModuleFlag   pack-level default per (industryPackId, moduleKey)
--   UserModuleOverride   per-customer override per (userId, moduleKey), wins over the pack default
-- Decision priority is implemented in src/lib/industry/moduleAccess.ts, not in the DB.

CREATE TABLE "IndustryModuleFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industryPackId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IndustryModuleFlag_industryPackId_fkey" FOREIGN KEY ("industryPackId") REFERENCES "IndustryPack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IndustryModuleFlag_industryPackId_moduleKey_key" ON "IndustryModuleFlag"("industryPackId", "moduleKey");
CREATE INDEX "IndustryModuleFlag_industryPackId_idx" ON "IndustryModuleFlag"("industryPackId");

CREATE TABLE "UserModuleOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserModuleOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserModuleOverride_userId_moduleKey_key" ON "UserModuleOverride"("userId", "moduleKey");
CREATE INDEX "UserModuleOverride_userId_idx" ON "UserModuleOverride"("userId");
