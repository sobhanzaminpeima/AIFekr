-- Section 1, item 7 — Property document archive. Reuses CrmDocument (adds
-- propertyId) rather than a parallel table. Also adds storageKey so future
-- uploads can be served through a short-lived authenticated redirect
-- instead of the long-lived link stored in fileUrl. Purely additive.

ALTER TABLE "CrmDocument" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "CrmDocument" ADD COLUMN "storageKey" TEXT;

CREATE INDEX "CrmDocument_propertyId_idx" ON "CrmDocument"("propertyId");
