-- Affiliate/referral wallet system. Purely additive, no existing data touched.

ALTER TABLE "User" ADD COLUMN "walletBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "relatedPaymentId" TEXT,
    "relatedUserId" TEXT,
    "payoutRequestId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletTransaction_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "WalletPayoutRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "WalletPayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "sheba" TEXT,
    "cardNumber" TEXT,
    "cardHolderName" TEXT,
    "paypalEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    CONSTRAINT "WalletPayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");
CREATE INDEX "WalletTransaction_payoutRequestId_idx" ON "WalletTransaction"("payoutRequestId");
CREATE INDEX "WalletPayoutRequest_userId_idx" ON "WalletPayoutRequest"("userId");
CREATE INDEX "WalletPayoutRequest_status_idx" ON "WalletPayoutRequest"("status");
