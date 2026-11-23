CREATE TABLE "GamingShortsOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "paymentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourceName" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "sourceBytes" INTEGER NOT NULL,
  "uploadedBytes" INTEGER NOT NULL DEFAULT 0,
  "sourceSeconds" REAL,
  "sourceSha256" TEXT,
  "sourceKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "rightsConfirmedAt" DATETIME NOT NULL,
  "uploadLease" TEXT,
  "uploadLeaseUntil" DATETIME,
  "delivery" TEXT NOT NULL DEFAULT '[]',
  "deliveryKey" TEXT,
  "approvedAt" DATETIME,
  "deliveredAt" DATETIME,
  "notifiedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "GamingShortsOrder_userId_requestKey_key" ON "GamingShortsOrder"("userId","requestKey");
CREATE UNIQUE INDEX "GamingShortsOrder_paymentId_key" ON "GamingShortsOrder"("paymentId");
CREATE INDEX "GamingShortsOrder_userId_createdAt_idx" ON "GamingShortsOrder"("userId","createdAt");
CREATE INDEX "GamingShortsOrder_status_createdAt_idx" ON "GamingShortsOrder"("status","createdAt");
