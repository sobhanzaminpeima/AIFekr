-- Presentation currency for a scheduled accounting report.
--
-- Language and currency are independent axes, and both are independent of the
-- reader's UI language: a Persian admin can schedule an English report priced
-- in EUR for an overseas owner.
--
-- NULL means no conversion, which stays the default for every existing row —
-- the report then shows amounts in the currency they were recorded in, and no
-- exchange rate is involved at all.
ALTER TABLE "AccountingScheduledReport" ADD COLUMN "currency" TEXT;
