-- Inbound event log (roadmap E6). Additive: one new table only. Stores no message or comment text.
-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountRef" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "latencyMs" INTEGER,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InboundEvent_receivedAt_idx" ON "InboundEvent"("receivedAt");
CREATE INDEX "InboundEvent_source_status_receivedAt_idx" ON "InboundEvent"("source", "status", "receivedAt");
CREATE INDEX "InboundEvent_accountRef_receivedAt_idx" ON "InboundEvent"("accountRef", "receivedAt");
