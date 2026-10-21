-- Tracks how much of a Payment's amount was covered by the affiliate wallet,
-- so the actual wallet deduction can happen at payment SUCCESS, not creation.
ALTER TABLE "Payment" ADD COLUMN "walletDiscountToman" INTEGER NOT NULL DEFAULT 0;
