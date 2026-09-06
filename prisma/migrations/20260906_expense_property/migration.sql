-- Attach a cost to the property it belongs to.
--
-- Before this, an expense had no property: you could record "electricity bill,
-- 4,200,000" but not which unit it was for. Owner statements therefore had
-- their expense lines typed in by hand every month, with nothing tying them to
-- the costs already recorded in the ledger.
--
-- Nullable and additive: agency-level costs (office rent, software) keep NULL,
-- and every existing row is unaffected.
ALTER TABLE "AccountingExpense" ADD COLUMN "propertyId" TEXT;
CREATE INDEX "AccountingExpense_propertyId_idx" ON "AccountingExpense"("propertyId");
