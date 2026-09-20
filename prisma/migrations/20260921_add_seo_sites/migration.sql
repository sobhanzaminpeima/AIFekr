-- CreateTable
CREATE TABLE "SeoSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "autoAudit" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "lastAuditAt" DATETIME,
    "nextAuditAt" DATETIME,
    "lastScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeoSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "score" INTEGER NOT NULL,
    "pagesCrawled" INTEGER NOT NULL,
    "failCount" INTEGER NOT NULL,
    "warnCount" INTEGER NOT NULL,
    "passCount" INTEGER NOT NULL,
    "siteChecks" TEXT NOT NULL,
    "pages" TEXT NOT NULL,
    "plan" TEXT,
    "planCreatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoAudit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SeoSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeoSite_userId_idx" ON "SeoSite"("userId");

-- CreateIndex
CREATE INDEX "SeoSite_businessId_idx" ON "SeoSite"("businessId");

-- CreateIndex
CREATE INDEX "SeoSite_autoAudit_nextAuditAt_idx" ON "SeoSite"("autoAudit", "nextAuditAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSite_userId_url_key" ON "SeoSite"("userId", "url");

-- CreateIndex
CREATE INDEX "SeoAudit_siteId_createdAt_idx" ON "SeoAudit"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoAudit_userId_idx" ON "SeoAudit"("userId");

