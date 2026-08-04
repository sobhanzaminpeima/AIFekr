-- Hand-written (not `prisma migrate diff` output) — same reasoning as the
-- prior two CRM migrations: plain ALTER TABLE ADD COLUMN (nullable/defaulted)
-- and plain CREATE TABLE never trigger SQLite's DROP+CREATE+re-INSERT table
-- rewrite that a generated diff would produce for FK-bearing additions.

ALTER TABLE "User" ADD COLUMN "crmPlan" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "crmPlanExpiry" DATETIME;

ALTER TABLE "TeamMember" ADD COLUMN "crmRole" TEXT;

ALTER TABLE "Package" ADD COLUMN "crmSeatLimit" INTEGER;

ALTER TABLE "CrmProduct" ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "CrmContact" ADD COLUMN "sourceDetails" TEXT;

CREATE TABLE "CrmInvoiceRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmInvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CrmInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CrmInvoiceRevision_invoiceId_idx" ON "CrmInvoiceRevision"("invoiceId");

CREATE TABLE "CrmContractRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmContractRevision_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CrmContract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CrmContractRevision_contractId_idx" ON "CrmContractRevision"("contractId");

CREATE TABLE "CrmProject" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contactId" TEXT,
  "dealId" TEXT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startDate" DATETIME,
  "endDate" DATETIME,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmProject_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmProject_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CrmProject_userId_idx" ON "CrmProject"("userId");
CREATE INDEX "CrmProject_contactId_idx" ON "CrmProject"("contactId");
CREATE INDEX "CrmProject_dealId_idx" ON "CrmProject"("dealId");
