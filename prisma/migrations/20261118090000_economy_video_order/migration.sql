CREATE TABLE "EconomyVideoOrder" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "topic" TEXT NOT NULL, "channel" TEXT NOT NULL, "credits" INTEGER NOT NULL,
  "standardCredits" INTEGER NOT NULL, "durationSeconds" INTEGER NOT NULL, "discountPercent" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" DATETIME, "deliveredBy" TEXT, "title" TEXT, "description" TEXT,
  "tags" TEXT NOT NULL DEFAULT '[]', "deliveryKey" TEXT
);
CREATE UNIQUE INDEX "EconomyVideoOrder_userId_idempotencyKey_key" ON "EconomyVideoOrder"("userId","idempotencyKey");
CREATE INDEX "EconomyVideoOrder_userId_createdAt_idx" ON "EconomyVideoOrder"("userId","createdAt");
CREATE INDEX "EconomyVideoOrder_status_createdAt_idx" ON "EconomyVideoOrder"("status","createdAt");
