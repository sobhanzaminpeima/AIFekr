CREATE TABLE IF NOT EXISTS "StudentStudySession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "activeUserKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentStudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentStudySession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentStudySession_activeUserKey_key" ON "StudentStudySession"("activeUserKey");
CREATE INDEX IF NOT EXISTS "StudentStudySession_userId_startedAt_idx" ON "StudentStudySession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "StudentStudySession_courseId_startedAt_idx" ON "StudentStudySession"("courseId", "startedAt");
