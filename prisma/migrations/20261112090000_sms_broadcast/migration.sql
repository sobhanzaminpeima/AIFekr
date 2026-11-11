-- Admin SMS sends: counts and text only, no phone numbers. Additive: one new table.
-- CreateTable
CREATE TABLE "SmsBroadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "SmsBroadcast_createdAt_idx" ON "SmsBroadcast"("createdAt");
