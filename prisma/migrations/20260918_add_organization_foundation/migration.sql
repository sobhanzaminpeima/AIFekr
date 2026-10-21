-- Multi-business foundation. All columns are nullable/defaulted so existing
-- single-business accounts remain valid until scripts/backfill-organizations.mjs
-- creates their default organization and workspace.
ALTER TABLE "User" ADD COLUMN "activeBusinessId" TEXT;

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "industry" TEXT,
  "country" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "language" TEXT NOT NULL DEFAULT 'fa',
  "brandSettings" TEXT,
  "resourceStrategy" TEXT NOT NULL DEFAULT 'SHARED',
  "planType" TEXT NOT NULL DEFAULT 'PERSONAL',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "subscriptionStartsAt" DATETIME,
  "subscriptionEndsAt" DATETIME,
  "renewalStatus" TEXT,
  "aiCredits" REAL NOT NULL DEFAULT 0,
  "mediaCredits" REAL NOT NULL DEFAULT 0,
  "voiceMinutes" REAL NOT NULL DEFAULT 0,
  "ownerId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

CREATE TABLE "BusinessWorkspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "businessType" TEXT,
  "industry" TEXT,
  "description" TEXT,
  "website" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "country" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "brandSettings" TEXT,
  "aiInstructions" TEXT,
  "modules" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "aiCreditLimit" REAL,
  "mediaCreditLimit" REAL,
  "voiceMinuteLimit" REAL,
  "limitMode" TEXT NOT NULL DEFAULT 'NONE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BusinessWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessWorkspace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessWorkspace_slug_key" ON "BusinessWorkspace"("slug");
CREATE INDEX "BusinessWorkspace_organizationId_status_idx" ON "BusinessWorkspace"("organizationId", "status");
CREATE INDEX "BusinessWorkspace_createdById_idx" ON "BusinessWorkspace"("createdById");
CREATE INDEX "User_activeBusinessId_idx" ON "User"("activeBusinessId");

CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "allBusinesses" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");

CREATE TABLE "BusinessMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "organizationMemberId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "permissions" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessMember_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "OrganizationMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");
CREATE INDEX "BusinessMember_organizationMemberId_idx" ON "BusinessMember"("organizationMemberId");
CREATE INDEX "BusinessMember_userId_status_idx" ON "BusinessMember"("userId", "status");

CREATE TABLE "OrganizationCreditLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "businessId" TEXT,
  "userId" TEXT,
  "resourceType" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "feature" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "providerCostUsd" REAL,
  "metadata" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationCreditLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationCreditLedger_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessWorkspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrganizationCreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationCreditLedger_idempotencyKey_key" ON "OrganizationCreditLedger"("idempotencyKey");
CREATE INDEX "OrganizationCreditLedger_organizationId_createdAt_idx" ON "OrganizationCreditLedger"("organizationId", "createdAt");
CREATE INDEX "OrganizationCreditLedger_businessId_createdAt_idx" ON "OrganizationCreditLedger"("businessId", "createdAt");
CREATE INDEX "OrganizationCreditLedger_userId_createdAt_idx" ON "OrganizationCreditLedger"("userId", "createdAt");

CREATE TABLE "OrganizationFeatureFlag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OrganizationFeatureFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationFeatureFlag_organizationId_key_key" ON "OrganizationFeatureFlag"("organizationId", "key");

CREATE TABLE "OrganizationAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "businessId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationAuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessWorkspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrganizationAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "createdAt");
CREATE INDEX "OrganizationAuditLog_businessId_createdAt_idx" ON "OrganizationAuditLog"("businessId", "createdAt");
CREATE INDEX "OrganizationAuditLog_actorId_idx" ON "OrganizationAuditLog"("actorId");
