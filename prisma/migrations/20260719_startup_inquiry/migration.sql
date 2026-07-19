CREATE TABLE "StartupInquiry" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT,
  "name"        TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "phone"       TEXT,
  "startupName" TEXT,
  "message"     TEXT NOT NULL,
  "stage"       TEXT NOT NULL DEFAULT 'new',
  "adminNote"   TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "StartupInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "StartupInquiry_stage_idx" ON "StartupInquiry"("stage");
CREATE INDEX "StartupInquiry_createdAt_idx" ON "StartupInquiry"("createdAt");
