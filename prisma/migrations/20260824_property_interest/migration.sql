-- Registers a buyer/tenant lead as interested in a specific property this
-- agency already has — distinct from Property.crmContactId (the owner
-- link). Purely additive.

CREATE TABLE "PropertyInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyInterest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyInterest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PropertyInterest_propertyId_contactId_key" ON "PropertyInterest"("propertyId", "contactId");
CREATE INDEX "PropertyInterest_userId_idx" ON "PropertyInterest"("userId");
CREATE INDEX "PropertyInterest_propertyId_idx" ON "PropertyInterest"("propertyId");
CREATE INDEX "PropertyInterest_contactId_idx" ON "PropertyInterest"("contactId");
