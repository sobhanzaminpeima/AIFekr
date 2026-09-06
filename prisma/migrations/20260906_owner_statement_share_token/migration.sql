-- A link the owner can open without a platform account.
--
-- "Send to owner" only ever sent an email with the figures inline; there was
-- no page to return to, forward, or open on a phone without hunting through
-- an inbox. Nullable and set once on first send, so existing rows are
-- unaffected until they are sent (or resent).
ALTER TABLE "AccountingOwnerStatement" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "AccountingOwnerStatement_shareToken_key" ON "AccountingOwnerStatement"("shareToken");
