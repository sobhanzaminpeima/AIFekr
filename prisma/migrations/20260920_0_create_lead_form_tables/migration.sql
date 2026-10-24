-- LeadForm, LeadSource were first created with `prisma db push` and never got a migration,
-- so a database built from migrations alone failed at 20260920_add_voice_leadgen_business_scope.
-- Recreated here in their pre-20260920_add_voice_leadgen_business_scope shape; IF NOT EXISTS keeps this a
-- no-op on databases that already have them.
CREATE TABLE IF NOT EXISTS "LeadForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleDe" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionDe" TEXT,
    "fields" TEXT NOT NULL DEFAULT '{}',
    "accentColor" TEXT NOT NULL DEFAULT '#ea580c',
    "logoUrl" TEXT,
    "submitLabel" TEXT,
    "successMessage" TEXT,
    "redirectUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadForm_slug_key" ON "LeadForm"("slug");
CREATE INDEX IF NOT EXISTS "LeadForm_userId_idx" ON "LeadForm"("userId");
CREATE TABLE IF NOT EXISTS "LeadSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "tokenExpiry" DATETIME,
    "webhookKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "lastLeadAt" DATETIME,
    "leadsImported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadSource_userId_idx" ON "LeadSource"("userId");
CREATE INDEX IF NOT EXISTS "LeadSource_provider_externalId_idx" ON "LeadSource"("provider", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadSource_userId_provider_externalId_key" ON "LeadSource"("userId", "provider", "externalId");
