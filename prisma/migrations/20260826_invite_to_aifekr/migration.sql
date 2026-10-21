ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "trialPlan" TEXT;
ALTER TABLE "User" ADD COLUMN "trialStartsAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "realEstatePackage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "invitedByAdminId" TEXT;
ALTER TABLE "User" ADD COLUMN "invitedAt" DATETIME;

CREATE TABLE "InviteCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "inviteText" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InviteCard_userId_idx" ON "InviteCard"("userId");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
