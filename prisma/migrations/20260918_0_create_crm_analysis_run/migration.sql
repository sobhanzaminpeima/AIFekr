-- CrmAnalysisRun was first created with `prisma db push` and never got its own
-- migration, so a database built from migrations alone failed at
-- 20260918_add_crm_business_scope. IF NOT EXISTS keeps this a no-op on
-- databases that already have the table.
CREATE TABLE IF NOT EXISTS "CrmAnalysisRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmAnalysisRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CrmAnalysisRun_userId_createdAt_idx" ON "CrmAnalysisRun"("userId", "createdAt");
