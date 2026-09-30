-- Confirmation + audit record for COMMIT-tier orchestrator tool calls.
-- A COMMIT tool never runs in the turn that proposes it: the validated
-- arguments land here as PENDING and only a second explicit request naming
-- this row's id can execute them.

CREATE TABLE "OrchestratorAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "workspaceUserId" TEXT NOT NULL,
    "actingUserId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "argsJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultJson" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "OrchestratorAction_conversationId_idx" ON "OrchestratorAction"("conversationId");
CREATE INDEX "OrchestratorAction_workspaceUserId_status_idx" ON "OrchestratorAction"("workspaceUserId", "status");
