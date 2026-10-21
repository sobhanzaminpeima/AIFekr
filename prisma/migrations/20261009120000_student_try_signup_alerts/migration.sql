ALTER TABLE "Package" ADD COLUMN "priceTry" INTEGER;
ALTER TABLE "User" ADD COLUMN "signupNotifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "signupNotificationClaimedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "signupNotificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "signupNotificationError" TEXT;
-- Never send retrospective registration notifications for existing accounts.
UPDATE "User" SET "signupNotifiedAt" = CURRENT_TIMESTAMP;
CREATE INDEX "User_signupNotifiedAt_createdAt_idx" ON "User"("signupNotifiedAt", "createdAt");
CREATE TABLE "ReferralCodeAlias" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCodeAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReferralCodeAlias_userId_idx" ON "ReferralCodeAlias"("userId");
