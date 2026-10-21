-- CreateTable
CREATE TABLE "FitnessTrainerApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trainerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "credentials" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL,
    "specialties" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "consentAt" DATETIME NOT NULL,
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessTrainerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitnessTrainerApplication_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "FitnessTrainer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainerId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    CONSTRAINT "FitnessAvailability_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "FitnessTrainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitnessBooking_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "FitnessTrainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitnessBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "FitnessAvailability" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessMarketOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "productId" TEXT,
    "bookingId" TEXT,
    "paymentId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "shippingAddress" TEXT,
    "fulfillmentReference" TEXT,
    "refundReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FitnessMarketOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitnessMarketOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FitnessProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FitnessMarketOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "FitnessBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessSellerLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessSellerLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FitnessMarketOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessVerifiedReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessVerifiedReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "FitnessBooking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTrainerApplication_userId_key" ON "FitnessTrainerApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTrainerApplication_trainerId_key" ON "FitnessTrainerApplication"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessAvailability_trainerId_startsAt_key" ON "FitnessAvailability"("trainerId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessBooking_paymentId_key" ON "FitnessBooking"("paymentId");

-- CreateIndex
CREATE INDEX "FitnessBooking_userId_createdAt_idx" ON "FitnessBooking"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMarketOrder_bookingId_key" ON "FitnessMarketOrder"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMarketOrder_paymentId_key" ON "FitnessMarketOrder"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMarketOrder_userId_clientKey_key" ON "FitnessMarketOrder"("userId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessSellerLedger_orderId_kind_key" ON "FitnessSellerLedger"("orderId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessVerifiedReview_bookingId_key" ON "FitnessVerifiedReview"("bookingId");
