-- Append-only credit ledger. Additive: a new table only; no existing table changes.
-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "type" TEXT NOT NULL,
    "operationId" TEXT,
    "module" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "pricingVersion" TEXT,
    "usageLogId" TEXT,
    "paymentId" TEXT,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_operationId_key" ON "CreditLedgerEntry"("operationId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_userId_createdAt_idx" ON "CreditLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_teamId_createdAt_idx" ON "CreditLedgerEntry"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_type_createdAt_idx" ON "CreditLedgerEntry"("type", "createdAt");
