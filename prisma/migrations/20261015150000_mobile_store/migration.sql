CREATE TABLE "MobileStorePurchase" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tokenHash" TEXT NOT NULL,
 "orderId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "productId" TEXT NOT NULL,
 "credits" INTEGER NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'GRANTED',
 "testPurchase" BOOLEAN NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MobileStorePurchase_tokenHash_key" ON "MobileStorePurchase"("tokenHash");
CREATE UNIQUE INDEX "MobileStorePurchase_orderId_key" ON "MobileStorePurchase"("orderId");
CREATE INDEX "MobileStorePurchase_userId_createdAt_idx" ON "MobileStorePurchase"("userId", "createdAt");
