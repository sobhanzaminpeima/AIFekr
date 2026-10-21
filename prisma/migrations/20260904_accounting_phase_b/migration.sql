-- Accounting module Phase B: expenses/vendors, agent commission + split,
-- and short-term rental owner statements.

ALTER TABLE "VoiceProperty" ADD COLUMN "ownerContactId" TEXT;

CREATE TABLE "AccountingVendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AccountingVendor_workspaceUserId_idx" ON "AccountingVendor"("workspaceUserId");

CREATE TABLE "AccountingExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "vendorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'cash_expense',
    "accountCode" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountingVendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AccountingExpense_workspaceUserId_idx" ON "AccountingExpense"("workspaceUserId");
CREATE INDEX "AccountingExpense_vendorId_idx" ON "AccountingExpense"("vendorId");

CREATE TABLE "AccountingCommissionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingCommissionRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AccountingCommissionRecord_workspaceUserId_idx" ON "AccountingCommissionRecord"("workspaceUserId");
CREATE INDEX "AccountingCommissionRecord_dealId_idx" ON "AccountingCommissionRecord"("dealId");

CREATE TABLE "AccountingCommissionSplit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionRecordId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "percent" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingCommissionSplit_commissionRecordId_fkey" FOREIGN KEY ("commissionRecordId") REFERENCES "AccountingCommissionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountingCommissionSplit_commissionRecordId_idx" ON "AccountingCommissionSplit"("commissionRecordId");
CREATE INDEX "AccountingCommissionSplit_agentUserId_idx" ON "AccountingCommissionSplit"("agentUserId");

CREATE TABLE "AccountingManagementFeeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "propertyId" TEXT,
    "feePercent" REAL NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AccountingManagementFeeRule_propertyId_key" ON "AccountingManagementFeeRule"("propertyId");
CREATE INDEX "AccountingManagementFeeRule_workspaceUserId_idx" ON "AccountingManagementFeeRule"("workspaceUserId");

CREATE TABLE "AccountingOwnerStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "incomeTotal" REAL NOT NULL DEFAULT 0,
    "expenseTotal" REAL NOT NULL DEFAULT 0,
    "netProfit" REAL NOT NULL DEFAULT 0,
    "managementFee" REAL NOT NULL DEFAULT 0,
    "ownerShare" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingOwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingOwnerStatement_propertyId_month_key" ON "AccountingOwnerStatement"("propertyId", "month");
CREATE INDEX "AccountingOwnerStatement_workspaceUserId_idx" ON "AccountingOwnerStatement"("workspaceUserId");

CREATE TABLE "AccountingOwnerStatementEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "income" REAL NOT NULL DEFAULT 0,
    "expense" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingOwnerStatementEntry_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "AccountingOwnerStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountingOwnerStatementEntry_statementId_idx" ON "AccountingOwnerStatementEntry"("statementId");
