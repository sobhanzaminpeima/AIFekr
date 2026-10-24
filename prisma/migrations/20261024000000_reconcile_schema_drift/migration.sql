-- Final reconciliation between the migration history and prisma/schema.prisma
-- (foreign keys, defaults and indexes that were only ever applied with db push).
-- Databases created with db push already match the schema and must mark this
-- as applied instead of running it:
--   npx prisma migrate resolve --applied 20261024000000_reconcile_schema_drift
-- DropIndex
DROP INDEX "StudentFlashcard_userId_nextReviewAt_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccountingExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceUserId" TEXT NOT NULL,
    "businessId" TEXT,
    "vendorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'cash_expense',
    "accountCode" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "propertyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountingVendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountingExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AccountingExpense" ("accountCode", "amount", "approvedAt", "approvedBy", "businessId", "createdAt", "currency", "description", "dueDate", "expenseDate", "id", "kind", "paidAt", "propertyId", "receiptUrl", "status", "taxAmount", "vendorId", "workspaceUserId") SELECT "accountCode", "amount", "approvedAt", "approvedBy", "businessId", "createdAt", "currency", "description", "dueDate", "expenseDate", "id", "kind", "paidAt", "propertyId", "receiptUrl", "status", "taxAmount", "vendorId", "workspaceUserId" FROM "AccountingExpense";
DROP TABLE "AccountingExpense";
ALTER TABLE "new_AccountingExpense" RENAME TO "AccountingExpense";
CREATE INDEX "AccountingExpense_workspaceUserId_idx" ON "AccountingExpense"("workspaceUserId");
CREATE INDEX "AccountingExpense_businessId_idx" ON "AccountingExpense"("businessId");
CREATE INDEX "AccountingExpense_vendorId_idx" ON "AccountingExpense"("vendorId");
CREATE TABLE "new_CeoTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "estimatedImpact" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ceo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CeoTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CeoTask" ("createdAt", "department", "description", "estimatedImpact", "id", "priority", "requiresApproval", "source", "status", "title", "updatedAt", "userId") SELECT "createdAt", "department", "description", "estimatedImpact", "id", "priority", "requiresApproval", "source", "status", "title", "updatedAt", "userId" FROM "CeoTask";
DROP TABLE "CeoTask";
ALTER TABLE "new_CeoTask" RENAME TO "CeoTask";
CREATE INDEX "CeoTask_userId_idx" ON "CeoTask"("userId");
CREATE INDEX "CeoTask_userId_status_idx" ON "CeoTask"("userId", "status");
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "tool" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "routingState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT,
    "businessId" TEXT,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("businessId", "createdAt", "id", "model", "projectId", "routingState", "title", "tool", "updatedAt", "userId") SELECT "businessId", "createdAt", "id", "model", "projectId", "routingState", "title", "tool", "updatedAt", "userId" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");
CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");
CREATE INDEX "Conversation_businessId_idx" ON "Conversation"("businessId");
CREATE TABLE "new_CrmContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "businessId" TEXT,
    "assignedToId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "telegram" TEXT,
    "company" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "source" TEXT NOT NULL DEFAULT 'organic',
    "sourceDetails" TEXT,
    "plan" TEXT,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tags" TEXT,
    "customFields" TEXT,
    "lastContact" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrmContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrmContact_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmContact" ("assignedToId", "businessId", "company", "createdAt", "customFields", "email", "id", "lastContact", "name", "notes", "phone", "plan", "source", "sourceDetails", "status", "tags", "telegram", "totalSpent", "updatedAt", "userId", "whatsapp") SELECT "assignedToId", "businessId", "company", "createdAt", "customFields", "email", "id", "lastContact", "name", "notes", "phone", "plan", "source", "sourceDetails", "status", "tags", "telegram", "totalSpent", "updatedAt", "userId", "whatsapp" FROM "CrmContact";
DROP TABLE "CrmContact";
ALTER TABLE "new_CrmContact" RENAME TO "CrmContact";
CREATE INDEX "CrmContact_userId_idx" ON "CrmContact"("userId");
CREATE INDEX "CrmContact_businessId_idx" ON "CrmContact"("businessId");
CREATE INDEX "CrmContact_status_idx" ON "CrmContact"("status");
CREATE INDEX "CrmContact_assignedToId_idx" ON "CrmContact"("assignedToId");
CREATE TABLE "new_CrmContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "contactId" TEXT NOT NULL,
    "dealId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrmContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmContract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmContract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrmContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CrmContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmContract" ("businessId", "contactId", "content", "createdAt", "dealId", "id", "signedAt", "status", "templateId", "title", "updatedAt", "userId") SELECT "businessId", "contactId", "content", "createdAt", "dealId", "id", "signedAt", "status", "templateId", "title", "updatedAt", "userId" FROM "CrmContract";
DROP TABLE "CrmContract";
ALTER TABLE "new_CrmContract" RENAME TO "CrmContract";
CREATE INDEX "CrmContract_userId_idx" ON "CrmContract"("userId");
CREATE INDEX "CrmContract_businessId_idx" ON "CrmContract"("businessId");
CREATE INDEX "CrmContract_contactId_idx" ON "CrmContract"("contactId");
CREATE INDEX "CrmContract_dealId_idx" ON "CrmContract"("dealId");
CREATE TABLE "new_CrmDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrmDocument_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrmDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmDocument" ("businessId", "contactId", "createdAt", "dealId", "fileUrl", "id", "name", "propertyId", "storageKey", "type", "userId") SELECT "businessId", "contactId", "createdAt", "dealId", "fileUrl", "id", "name", "propertyId", "storageKey", "type", "userId" FROM "CrmDocument";
DROP TABLE "CrmDocument";
ALTER TABLE "new_CrmDocument" RENAME TO "CrmDocument";
CREATE INDEX "CrmDocument_userId_idx" ON "CrmDocument"("userId");
CREATE INDEX "CrmDocument_businessId_idx" ON "CrmDocument"("businessId");
CREATE INDEX "CrmDocument_contactId_idx" ON "CrmDocument"("contactId");
CREATE INDEX "CrmDocument_dealId_idx" ON "CrmDocument"("dealId");
CREATE INDEX "CrmDocument_propertyId_idx" ON "CrmDocument"("propertyId");
CREATE TABLE "new_CrmInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "contactId" TEXT NOT NULL,
    "dealId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxTotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrmInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmInvoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmInvoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmInvoice" ("businessId", "contactId", "createdAt", "currency", "dealId", "discount", "dueDate", "id", "invoiceNumber", "issueDate", "notes", "paidAt", "status", "subtotal", "taxTotal", "total", "updatedAt", "userId") SELECT "businessId", "contactId", "createdAt", "currency", "dealId", "discount", "dueDate", "id", "invoiceNumber", "issueDate", "notes", "paidAt", "status", "subtotal", "taxTotal", "total", "updatedAt", "userId" FROM "CrmInvoice";
DROP TABLE "CrmInvoice";
ALTER TABLE "new_CrmInvoice" RENAME TO "CrmInvoice";
CREATE UNIQUE INDEX "CrmInvoice_invoiceNumber_key" ON "CrmInvoice"("invoiceNumber");
CREATE INDEX "CrmInvoice_userId_idx" ON "CrmInvoice"("userId");
CREATE INDEX "CrmInvoice_businessId_idx" ON "CrmInvoice"("businessId");
CREATE INDEX "CrmInvoice_contactId_idx" ON "CrmInvoice"("contactId");
CREATE INDEX "CrmInvoice_dealId_idx" ON "CrmInvoice"("dealId");
CREATE TABLE "new_CrmInvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "CrmInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CrmInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CrmProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmInvoiceItem" ("description", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxRate", "unitPrice") SELECT "description", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxRate", "unitPrice" FROM "CrmInvoiceItem";
DROP TABLE "CrmInvoiceItem";
ALTER TABLE "new_CrmInvoiceItem" RENAME TO "CrmInvoiceItem";
CREATE INDEX "CrmInvoiceItem_invoiceId_idx" ON "CrmInvoiceItem"("invoiceId");
CREATE TABLE "new_CrmProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrmProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrmProject_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrmProject_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrmProject" ("businessId", "contactId", "createdAt", "dealId", "description", "endDate", "id", "name", "startDate", "status", "updatedAt", "userId") SELECT "businessId", "contactId", "createdAt", "dealId", "description", "endDate", "id", "name", "startDate", "status", "updatedAt", "userId" FROM "CrmProject";
DROP TABLE "CrmProject";
ALTER TABLE "new_CrmProject" RENAME TO "CrmProject";
CREATE INDEX "CrmProject_userId_idx" ON "CrmProject"("userId");
CREATE INDEX "CrmProject_businessId_idx" ON "CrmProject"("businessId");
CREATE INDEX "CrmProject_contactId_idx" ON "CrmProject"("contactId");
CREATE INDEX "CrmProject_dealId_idx" ON "CrmProject"("dealId");
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'quiz',
    "durationSec" INTEGER NOT NULL DEFAULT 120,
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Game" ("createdAt", "description", "durationSec", "id", "isActive", "isFeatured", "name", "nameEn", "slug", "type") SELECT "createdAt", "description", "durationSec", "id", "isActive", "isFeatured", "name", "nameEn", "slug", "type" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");
CREATE TABLE "new_GameQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textEn" TEXT,
    "options" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "order" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    CONSTRAINT "GameQuestion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameQuestion" ("correctOption", "difficulty", "gameId", "id", "options", "order", "points", "text", "textEn") SELECT "correctOption", "difficulty", "gameId", "id", "options", "order", "points", "text", "textEn" FROM "GameQuestion";
DROP TABLE "GameQuestion";
ALTER TABLE "new_GameQuestion" RENAME TO "GameQuestion";
CREATE INDEX "GameQuestion_gameId_idx" ON "GameQuestion"("gameId");
CREATE TABLE "new_GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("completedAt", "gameId", "id", "maxScore", "metadata", "score", "status", "userId") SELECT "completedAt", "gameId", "id", "maxScore", "metadata", "score", "status", "userId" FROM "GameSession";
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
CREATE INDEX "GameSession_gameId_score_idx" ON "GameSession"("gameId", "score" DESC);
CREATE INDEX "GameSession_userId_idx" ON "GameSession"("userId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#ea580c',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("color", "createdAt", "description", "icon", "id", "name", "updatedAt", "userId") SELECT "color", "createdAt", "description", "icon", "id", "name", "updatedAt", "userId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE TABLE "new_PropertyBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "propertyId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "guestName" TEXT,
    "contactId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyBooking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PropertyBooking" ("businessId", "checkIn", "checkOut", "contactId", "createdAt", "guestName", "id", "notes", "propertyId", "source", "status", "updatedAt", "userId") SELECT "businessId", "checkIn", "checkOut", "contactId", "createdAt", "guestName", "id", "notes", "propertyId", "source", "status", "updatedAt", "userId" FROM "PropertyBooking";
DROP TABLE "PropertyBooking";
ALTER TABLE "new_PropertyBooking" RENAME TO "PropertyBooking";
CREATE INDEX "PropertyBooking_userId_idx" ON "PropertyBooking"("userId");
CREATE INDEX "PropertyBooking_businessId_idx" ON "PropertyBooking"("businessId");
CREATE INDEX "PropertyBooking_propertyId_idx" ON "PropertyBooking"("propertyId");
CREATE INDEX "PropertyBooking_contactId_idx" ON "PropertyBooking"("contactId");
CREATE INDEX "PropertyBooking_checkIn_idx" ON "PropertyBooking"("checkIn");
CREATE INDEX "PropertyBooking_checkOut_idx" ON "PropertyBooking"("checkOut");
CREATE TABLE "new_PropertyInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyInterest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyInterest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PropertyInterest" ("businessId", "contactId", "createdAt", "id", "note", "propertyId", "userId") SELECT "businessId", "contactId", "createdAt", "id", "note", "propertyId", "userId" FROM "PropertyInterest";
DROP TABLE "PropertyInterest";
ALTER TABLE "new_PropertyInterest" RENAME TO "PropertyInterest";
CREATE INDEX "PropertyInterest_userId_idx" ON "PropertyInterest"("userId");
CREATE INDEX "PropertyInterest_businessId_idx" ON "PropertyInterest"("businessId");
CREATE INDEX "PropertyInterest_propertyId_idx" ON "PropertyInterest"("propertyId");
CREATE INDEX "PropertyInterest_contactId_idx" ON "PropertyInterest"("contactId");
CREATE UNIQUE INDEX "PropertyInterest_propertyId_contactId_key" ON "PropertyInterest"("propertyId", "contactId");
CREATE TABLE "new_PropertyViewing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT,
    "assignedToId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "feedback" TEXT,
    "feedbackRating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyViewing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "VoiceProperty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyViewing_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PropertyViewing_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PropertyViewing" ("assignedToId", "businessId", "contactId", "createdAt", "durationMin", "feedback", "feedbackRating", "id", "propertyId", "scheduledAt", "status", "updatedAt", "userId") SELECT "assignedToId", "businessId", "contactId", "createdAt", "durationMin", "feedback", "feedbackRating", "id", "propertyId", "scheduledAt", "status", "updatedAt", "userId" FROM "PropertyViewing";
DROP TABLE "PropertyViewing";
ALTER TABLE "new_PropertyViewing" RENAME TO "PropertyViewing";
CREATE INDEX "PropertyViewing_userId_idx" ON "PropertyViewing"("userId");
CREATE INDEX "PropertyViewing_businessId_idx" ON "PropertyViewing"("businessId");
CREATE INDEX "PropertyViewing_propertyId_idx" ON "PropertyViewing"("propertyId");
CREATE INDEX "PropertyViewing_contactId_idx" ON "PropertyViewing"("contactId");
CREATE INDEX "PropertyViewing_assignedToId_idx" ON "PropertyViewing"("assignedToId");
CREATE INDEX "PropertyViewing_scheduledAt_idx" ON "PropertyViewing"("scheduledAt");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "aiCredits" REAL NOT NULL DEFAULT 0,
    "mediaCredits" REAL NOT NULL DEFAULT 0,
    "voiceMinutes" REAL NOT NULL DEFAULT 0,
    "planExpiry" DATETIME,
    "maxSeats" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("aiCredits", "createdAt", "credits", "id", "maxSeats", "mediaCredits", "name", "ownerId", "planExpiry", "updatedAt", "voiceMinutes") SELECT "aiCredits", "createdAt", "credits", "id", "maxSeats", "mediaCredits", "name", "ownerId", "planExpiry", "updatedAt", "voiceMinutes" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_ownerId_key" ON "Team"("ownerId");
CREATE TABLE "new_TeamInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamInvite" ("createdAt", "email", "expiresAt", "id", "invitedBy", "status", "teamId", "token") SELECT "createdAt", "email", "expiresAt", "id", "invitedBy", "status", "teamId", "token" FROM "TeamInvite";
DROP TABLE "TeamInvite";
ALTER TABLE "new_TeamInvite" RENAME TO "TeamInvite";
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");
CREATE TABLE "new_TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "crmRole" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamMember" ("crmRole", "id", "joinedAt", "role", "teamId", "userId") SELECT "crmRole", "id", "joinedAt", "role", "teamId", "userId" FROM "TeamMember";
DROP TABLE "TeamMember";
ALTER TABLE "new_TeamMember" RENAME TO "TeamMember";
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");
CREATE TABLE "new_User" (
    "fitnessAccessExpiry" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "signupNotifiedAt" DATETIME,
    "signupNotificationClaimedAt" DATETIME,
    "signupNotificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "signupNotificationError" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "country" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'PERSONAL',
    "language" TEXT,
    "currency" TEXT,
    "avatar" TEXT,
    "studentPublicSlug" TEXT,
    "studentProfilePublic" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "credits" INTEGER NOT NULL DEFAULT 100,
    "aiCredits" REAL NOT NULL DEFAULT 0,
    "mediaCredits" REAL NOT NULL DEFAULT 0,
    "voiceMinutes" REAL NOT NULL DEFAULT 0,
    "planExpiry" DATETIME,
    "voicePlan" TEXT NOT NULL DEFAULT 'NONE',
    "voicePlanExpiry" DATETIME,
    "crmPlan" TEXT NOT NULL DEFAULT 'NONE',
    "crmPlanExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "industryPackId" TEXT,
    "googleId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'password',
    "ceoAutoRunEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ceoAutoRunLang" TEXT NOT NULL DEFAULT 'fa',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "chatOnly" BOOLEAN NOT NULL DEFAULT false,
    "chatPlanExpiry" DATETIME,
    "platformEntry" TEXT NOT NULL DEFAULT '',
    "referralDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "referralRewarded" BOOLEAN NOT NULL DEFAULT false,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "commissionPercentOverride" INTEGER,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "trialPlan" TEXT,
    "trialStartsAt" DATETIME,
    "trialEndsAt" DATETIME,
    "realEstatePackage" BOOLEAN NOT NULL DEFAULT false,
    "trialLimited" BOOLEAN NOT NULL DEFAULT false,
    "invitedByAdminId" TEXT,
    "invitedAt" DATETIME,
    "activeBusinessId" TEXT,
    CONSTRAINT "User_industryPackId_fkey" FOREIGN KEY ("industryPackId") REFERENCES "IndustryPack" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_activeBusinessId_fkey" FOREIGN KEY ("activeBusinessId") REFERENCES "BusinessWorkspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accountType", "activeBusinessId", "aiCredits", "authProvider", "avatar", "ceoAutoRunEnabled", "ceoAutoRunLang", "chatOnly", "chatPlanExpiry", "commissionPercentOverride", "country", "createdAt", "credits", "crmPlan", "crmPlanExpiry", "currency", "email", "firstName", "fitnessAccessExpiry", "googleId", "id", "industryPackId", "invitedAt", "invitedByAdminId", "isBlocked", "language", "lastLoginAt", "lastName", "mediaCredits", "mustChangePassword", "name", "onboardingDone", "passwordHash", "phone", "plan", "planExpiry", "platformEntry", "realEstatePackage", "referralCode", "referralDiscountPercent", "referralRewarded", "referredBy", "role", "signupNotificationAttempts", "signupNotificationClaimedAt", "signupNotificationError", "signupNotifiedAt", "studentProfilePublic", "studentPublicSlug", "trialEndsAt", "trialLimited", "trialPlan", "trialStartsAt", "updatedAt", "voiceMinutes", "voicePlan", "voicePlanExpiry", "walletBalance") SELECT "accountType", "activeBusinessId", "aiCredits", "authProvider", "avatar", "ceoAutoRunEnabled", "ceoAutoRunLang", "chatOnly", "chatPlanExpiry", "commissionPercentOverride", "country", "createdAt", "credits", "crmPlan", "crmPlanExpiry", "currency", "email", "firstName", "fitnessAccessExpiry", "googleId", "id", "industryPackId", "invitedAt", "invitedByAdminId", "isBlocked", "language", "lastLoginAt", "lastName", "mediaCredits", "mustChangePassword", "name", "onboardingDone", "passwordHash", "phone", "plan", "planExpiry", "platformEntry", "realEstatePackage", "referralCode", "referralDiscountPercent", "referralRewarded", "referredBy", "role", "signupNotificationAttempts", "signupNotificationClaimedAt", "signupNotificationError", "signupNotifiedAt", "studentProfilePublic", "studentPublicSlug", "trialEndsAt", "trialLimited", "trialPlan", "trialStartsAt", "updatedAt", "voiceMinutes", "voicePlan", "voicePlanExpiry", "walletBalance" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_studentPublicSlug_key" ON "User"("studentPublicSlug");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_signupNotifiedAt_createdAt_idx" ON "User"("signupNotifiedAt", "createdAt");
CREATE INDEX "User_industryPackId_idx" ON "User"("industryPackId");
CREATE INDEX "User_activeBusinessId_idx" ON "User"("activeBusinessId");
CREATE TABLE "new_VoiceCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "agentId" TEXT NOT NULL,
    "contactId" TEXT,
    "vapiCallId" TEXT,
    "callerPhone" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "outcome" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "durationSec" INTEGER,
    "recordingUrl" TEXT,
    "cost" REAL,
    "reservedCredits" INTEGER NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "billingStatus" TEXT NOT NULL DEFAULT 'pending',
    "creditTeamId" TEXT,
    "creditsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "VoiceCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCallLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCallLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VoiceCallLog" ("agentId", "billingStatus", "businessId", "callerPhone", "contactId", "cost", "createdAt", "creditTeamId", "creditsCharged", "creditsPerMinute", "direction", "durationSec", "endedAt", "id", "outcome", "recordingUrl", "reservedCredits", "status", "summary", "transcript", "userId", "vapiCallId") SELECT "agentId", "billingStatus", "businessId", "callerPhone", "contactId", "cost", "createdAt", "creditTeamId", "creditsCharged", "creditsPerMinute", "direction", "durationSec", "endedAt", "id", "outcome", "recordingUrl", "reservedCredits", "status", "summary", "transcript", "userId", "vapiCallId" FROM "VoiceCallLog";
DROP TABLE "VoiceCallLog";
ALTER TABLE "new_VoiceCallLog" RENAME TO "VoiceCallLog";
CREATE UNIQUE INDEX "VoiceCallLog_vapiCallId_key" ON "VoiceCallLog"("vapiCallId");
CREATE INDEX "VoiceCallLog_userId_idx" ON "VoiceCallLog"("userId");
CREATE INDEX "VoiceCallLog_agentId_idx" ON "VoiceCallLog"("agentId");
CREATE INDEX "VoiceCallLog_contactId_idx" ON "VoiceCallLog"("contactId");
CREATE INDEX "VoiceCallLog_businessId_idx" ON "VoiceCallLog"("businessId");
CREATE TABLE "new_VoiceProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "agentId" TEXT,
    "crmContactId" TEXT,
    "crmDealId" TEXT,
    "crmProjectId" TEXT,
    "ownerContactId" TEXT,
    "title" TEXT NOT NULL,
    "listingType" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'apartment',
    "price" BIGINT NOT NULL,
    "nightlyPrice" BIGINT,
    "bookingLink" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" INTEGER,
    "description" TEXT,
    "images" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "status" TEXT NOT NULL DEFAULT 'available',
    "representationStartDate" DATETIME,
    "representationEndDate" DATETIME,
    "agreedCommissionRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "VoiceAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_ownerContactId_fkey" FOREIGN KEY ("ownerContactId") REFERENCES "CrmContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_crmDealId_fkey" FOREIGN KEY ("crmDealId") REFERENCES "CrmDeal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VoiceProperty_crmProjectId_fkey" FOREIGN KEY ("crmProjectId") REFERENCES "CrmProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VoiceProperty" ("address", "agentId", "agreedCommissionRate", "areaSqm", "bathrooms", "bedrooms", "bookingLink", "businessId", "city", "createdAt", "crmContactId", "crmDealId", "crmProjectId", "currency", "description", "id", "images", "listingType", "nightlyPrice", "ownerContactId", "price", "propertyType", "representationEndDate", "representationStartDate", "status", "title", "updatedAt", "userId") SELECT "address", "agentId", "agreedCommissionRate", "areaSqm", "bathrooms", "bedrooms", "bookingLink", "businessId", "city", "createdAt", "crmContactId", "crmDealId", "crmProjectId", "currency", "description", "id", "images", "listingType", "nightlyPrice", "ownerContactId", "price", "propertyType", "representationEndDate", "representationStartDate", "status", "title", "updatedAt", "userId" FROM "VoiceProperty";
DROP TABLE "VoiceProperty";
ALTER TABLE "new_VoiceProperty" RENAME TO "VoiceProperty";
CREATE INDEX "VoiceProperty_userId_idx" ON "VoiceProperty"("userId");
CREATE INDEX "VoiceProperty_businessId_idx" ON "VoiceProperty"("businessId");
CREATE INDEX "VoiceProperty_agentId_idx" ON "VoiceProperty"("agentId");
CREATE INDEX "VoiceProperty_crmContactId_idx" ON "VoiceProperty"("crmContactId");
CREATE INDEX "VoiceProperty_ownerContactId_idx" ON "VoiceProperty"("ownerContactId");
CREATE INDEX "VoiceProperty_crmDealId_idx" ON "VoiceProperty"("crmDealId");
CREATE INDEX "VoiceProperty_crmProjectId_idx" ON "VoiceProperty"("crmProjectId");
CREATE TABLE "new_WalletPayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "sheba" TEXT,
    "cardNumber" TEXT,
    "cardHolderName" TEXT,
    "paypalEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    CONSTRAINT "WalletPayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WalletPayoutRequest" ("adminNote", "amount", "cardHolderName", "cardNumber", "createdAt", "id", "method", "paypalEmail", "resolvedAt", "resolvedById", "sheba", "status", "userId") SELECT "adminNote", "amount", "cardHolderName", "cardNumber", "createdAt", "id", "method", "paypalEmail", "resolvedAt", "resolvedById", "sheba", "status", "userId" FROM "WalletPayoutRequest";
DROP TABLE "WalletPayoutRequest";
ALTER TABLE "new_WalletPayoutRequest" RENAME TO "WalletPayoutRequest";
CREATE INDEX "WalletPayoutRequest_userId_idx" ON "WalletPayoutRequest"("userId");
CREATE INDEX "WalletPayoutRequest_status_idx" ON "WalletPayoutRequest"("status");
CREATE TABLE "new_WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "relatedPaymentId" TEXT,
    "relatedUserId" TEXT,
    "payoutRequestId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletTransaction_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "WalletPayoutRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WalletTransaction" ("amount", "createdAt", "id", "note", "payoutRequestId", "relatedPaymentId", "relatedUserId", "type", "userId") SELECT "amount", "createdAt", "id", "note", "payoutRequestId", "relatedPaymentId", "relatedUserId", "type", "userId" FROM "WalletTransaction";
DROP TABLE "WalletTransaction";
ALTER TABLE "new_WalletTransaction" RENAME TO "WalletTransaction";
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");
CREATE INDEX "WalletTransaction_payoutRequestId_idx" ON "WalletTransaction"("payoutRequestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAnalysis_shareToken_key" ON "BusinessAnalysis"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPipelineRun_shareToken_key" ON "ContentPipelineRun"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptHash_key" ON "Payment"("receiptHash");

