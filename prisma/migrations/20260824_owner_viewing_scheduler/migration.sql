-- Section 1, items 2 (Owner Management) and 4 (Viewing Scheduler).
-- Purely additive, no existing data touched.

-- Item 2: owner-representation terms live on Property (an owner is derived
-- from being linked via Property.crmContactId to >=1 property; no new
-- column on CrmContact).
ALTER TABLE "VoiceProperty" ADD COLUMN "representationStartDate" DATETIME;
ALTER TABLE "VoiceProperty" ADD COLUMN "representationEndDate" DATETIME;
ALTER TABLE "VoiceProperty" ADD COLUMN "agreedCommissionRate" REAL;

-- Item 4: a real appointment-slot model for viewings, separate from
-- VoiceAppointment (which is structurally tied to a VoiceAgent's phone calls).
CREATE TABLE "PropertyViewing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT,
    "assignedToId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "feedback" TEXT,
    "feedbackRating" INTEGER,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyViewing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyViewing_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PropertyViewing_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PropertyViewing_userId_idx" ON "PropertyViewing"("userId");
CREATE INDEX "PropertyViewing_propertyId_idx" ON "PropertyViewing"("propertyId");
CREATE INDEX "PropertyViewing_contactId_idx" ON "PropertyViewing"("contactId");
CREATE INDEX "PropertyViewing_assignedToId_idx" ON "PropertyViewing"("assignedToId");
CREATE INDEX "PropertyViewing_scheduledAt_idx" ON "PropertyViewing"("scheduledAt");
