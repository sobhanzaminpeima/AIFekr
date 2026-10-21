-- Persist the billing term on each payment so activation grants the term
-- that was actually paid for (annual used to activate for 30 days).

ALTER TABLE "Payment" ADD COLUMN "periodMonths" INTEGER NOT NULL DEFAULT 1;
