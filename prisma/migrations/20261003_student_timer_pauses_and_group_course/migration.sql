ALTER TABLE "StudentStudySession" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "StudentStudySession" ADD COLUMN "lastResumedAt" DATETIME;
ALTER TABLE "StudentStudySession" ADD COLUMN "pauseHistory" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "StudentStudyGroup" ADD COLUMN "courseId" TEXT REFERENCES "StudentCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StudentStudyGroup_courseId_createdAt_idx" ON "StudentStudyGroup"("courseId", "createdAt");
