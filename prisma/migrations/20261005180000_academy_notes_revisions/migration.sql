BEGIN IMMEDIATE;
CREATE TABLE "AiCourseLessonNote" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"versionId" TEXT NOT NULL,"lessonId" TEXT NOT NULL,"content" TEXT NOT NULL DEFAULT '',"updatedAt" DATETIME NOT NULL,CONSTRAINT "AiCourseLessonNote_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AiCourseVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "AiCourseLessonNote_userId_versionId_lessonId_key" ON "AiCourseLessonNote"("userId","versionId","lessonId");
CREATE TABLE "AiCourseRevision" ("id" TEXT NOT NULL PRIMARY KEY,"courseId" TEXT NOT NULL,"version" INTEGER NOT NULL,"actorId" TEXT NOT NULL,"reason" TEXT NOT NULL,"metadata" TEXT NOT NULL,"content" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "AiCourseRevision_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AiCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "AiCourseRevision_courseId_version_key" ON "AiCourseRevision"("courseId","version");
ALTER TABLE "AiCourseCertificate" ADD COLUMN "verificationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiCourseCertificate" ADD COLUMN "lastVerifiedAt" DATETIME;
COMMIT;
