CREATE TABLE "StudentTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "taskType" TEXT NOT NULL DEFAULT 'assignment',
  "dueAt" DATETIME,
  "priority" INTEGER NOT NULL DEFAULT 2,
  "completedAt" DATETIME,
  "generated" BOOLEAN NOT NULL DEFAULT false,
  "dedupeKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentTask_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "StudentTask_userId_completedAt_dueAt_idx" ON "StudentTask"("userId", "completedAt", "dueAt");
CREATE INDEX "StudentTask_courseId_dueAt_idx" ON "StudentTask"("courseId", "dueAt");
CREATE UNIQUE INDEX "StudentTask_dedupeKey_key" ON "StudentTask"("dedupeKey");
