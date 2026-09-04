-- Accounting module Phase C: bank reconciliation, tax rates, budgets.

ALTER TABLE "AccountingExpense" ADD COLUMN "taxAmount" REAL NOT NULL DEFAULT 0;

CREATE TABLE "AccountingBankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AccountingBankAccount_workspaceUserId_idx" ON "AccountingBankAccount"("workspaceUserId");

CREATE TABLE "AccountingBankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "matchedType" TEXT,
    "matchedId" TEXT,
    "matchedAt" DATETIME,
    "matchedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingBankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "AccountingBankAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountingBankTransaction_workspaceUserId_idx" ON "AccountingBankTransaction"("workspaceUserId");
CREATE INDEX "AccountingBankTransaction_bankAccountId_idx" ON "AccountingBankTransaction"("bankAccountId");
CREATE INDEX "AccountingBankTransaction_status_idx" ON "AccountingBankTransaction"("status");

CREATE TABLE "AccountingTaxRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePercent" REAL NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AccountingTaxRate_workspaceUserId_idx" ON "AccountingTaxRate"("workspaceUserId");

CREATE TABLE "AccountingBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "period" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AccountingBudget_workspaceUserId_accountCode_period_key" ON "AccountingBudget"("workspaceUserId", "accountCode", "period");
CREATE INDEX "AccountingBudget_workspaceUserId_idx" ON "AccountingBudget"("workspaceUserId");
