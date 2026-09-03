-- Accounting module Phase A: chart of accounts + double-entry ledger core.

CREATE TABLE "AccountingAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameDe" TEXT,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountingAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingAccount_workspaceUserId_code_key" ON "AccountingAccount"("workspaceUserId", "code");
CREATE INDEX "AccountingAccount_workspaceUserId_idx" ON "AccountingAccount"("workspaceUserId");

CREATE TABLE "AccountingFiscalPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AccountingFiscalPeriod_workspaceUserId_idx" ON "AccountingFiscalPeriod"("workspaceUserId");

CREATE TABLE "AccountingJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "sourceRef" TEXT,
    "reversesEntryId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "postedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingJournalEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "AccountingJournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingJournalEntry_sourceRef_key" ON "AccountingJournalEntry"("sourceRef");
CREATE INDEX "AccountingJournalEntry_workspaceUserId_entryDate_idx" ON "AccountingJournalEntry"("workspaceUserId", "entryDate");

-- debit/credit are mutually exclusive per line (real, DB-enforced,
-- single-row invariant). The cross-row "sum(debit) == sum(credit) per
-- entry" invariant cannot be expressed as a SQLite CHECK/trigger without a
-- deferred-constraint mechanism SQLite does not have; it is enforced by
-- postJournalEntry() being the sole write path (see its unit tests).
CREATE TABLE "AccountingJournalEntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    CONSTRAINT "AccountingJournalEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingJournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournalEntryLine_amounts_check" CHECK (
        "debit" >= 0 AND "credit" >= 0 AND NOT ("debit" > 0 AND "credit" > 0) AND ("debit" > 0 OR "credit" > 0)
    )
);

CREATE INDEX "AccountingJournalEntryLine_entryId_idx" ON "AccountingJournalEntryLine"("entryId");
CREATE INDEX "AccountingJournalEntryLine_accountId_idx" ON "AccountingJournalEntryLine"("accountId");
