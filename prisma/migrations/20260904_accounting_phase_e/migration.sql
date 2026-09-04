-- Phase E: Finance AI Agent — the only new table is the Draft-and-Approve
-- proposal queue. The agent itself never gets a write path to any other
-- accounting table.

CREATE TABLE "AccountingAiProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceContext" TEXT,
    "modelUsed" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME
);
CREATE INDEX "AccountingAiProposal_workspaceUserId_idx" ON "AccountingAiProposal"("workspaceUserId");
CREATE INDEX "AccountingAiProposal_status_idx" ON "AccountingAiProposal"("status");
