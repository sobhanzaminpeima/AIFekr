-- Turkish name for ledger accounts. Same shape as nameDe: every consumer
-- previously fell back to Persian for Turkish (and any other) language.
-- Nullable: existing rows keep working, falling back to English/Persian.

ALTER TABLE "AccountingAccount" ADD COLUMN "nameTr" TEXT;
