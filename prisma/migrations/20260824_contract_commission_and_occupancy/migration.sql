-- Section 1, items 5 (Contract & Commission) and 6 (Short-term rental
-- occupancy calendar). Purely additive, no existing data touched.

-- Item 5: closing-time financial fields added directly to CrmDeal (deal
-- date = wonAt, final amount = value already exist on the row).
ALTER TABLE "CrmDeal" ADD COLUMN "commissionRate" REAL;
ALTER TABLE "CrmDeal" ADD COLUMN "commissionAmount" REAL;
ALTER TABLE "CrmDeal" ADD COLUMN "commissionPaymentStatus" TEXT NOT NULL DEFAULT 'unpaid';

-- Item 6: occupancy calendar, one row per booked stay.
CREATE TABLE "PropertyBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "guestName" TEXT,
    "contactId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyBooking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PropertyBooking_userId_idx" ON "PropertyBooking"("userId");
CREATE INDEX "PropertyBooking_propertyId_idx" ON "PropertyBooking"("propertyId");
CREATE INDEX "PropertyBooking_contactId_idx" ON "PropertyBooking"("contactId");
CREATE INDEX "PropertyBooking_checkIn_idx" ON "PropertyBooking"("checkIn");
CREATE INDEX "PropertyBooking_checkOut_idx" ON "PropertyBooking"("checkOut");
