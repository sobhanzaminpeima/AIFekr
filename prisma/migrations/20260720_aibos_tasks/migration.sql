CREATE TABLE "CeoTask" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "department"       TEXT NOT NULL,
  "priority"         TEXT NOT NULL DEFAULT 'medium',
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT 0,
  "estimatedImpact"  TEXT,
  "source"           TEXT NOT NULL DEFAULT 'ceo',
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CeoTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CeoTask_userId_idx" ON "CeoTask"("userId");
CREATE INDEX "CeoTask_userId_status_idx" ON "CeoTask"("userId", "status");

CREATE TABLE "BoardroomSession" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'running',
  "healthScore" INTEGER,
  "summary"     TEXT,
  "departments" TEXT,
  "tasksJson"   TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardroomSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BoardroomSession_userId_idx" ON "BoardroomSession"("userId");
