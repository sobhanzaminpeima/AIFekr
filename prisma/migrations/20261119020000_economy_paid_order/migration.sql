ALTER TABLE "EconomyVideoOrder" ADD COLUMN "paymentId" TEXT;
CREATE UNIQUE INDEX "EconomyVideoOrder_paymentId_key" ON "EconomyVideoOrder"("paymentId");
