BEGIN IMMEDIATE;
-- CreateTable
CREATE TABLE "AiCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "activeJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AiCourseGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "credits" INTEGER NOT NULL,
    "usageLogId" TEXT NOT NULL,
    "payerTeamId" TEXT,
    "mirroredAi" REAL NOT NULL DEFAULT 0,
    "previousStatus" TEXT NOT NULL,
    "failureCode" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "AiCourseGenerationJob_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AiCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCourseProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "completed" TEXT NOT NULL DEFAULT '[]',
    "quizPassed" TEXT NOT NULL DEFAULT '[]',
    "completedAt" DATETIME,
    "certificateId" TEXT,
    "certificateTitle" TEXT,
    "certificateName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiCourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AiCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiCourse_status_language_idx" ON "AiCourse"("status", "language");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseGenerationJob_usageLogId_key" ON "AiCourseGenerationJob"("usageLogId");

-- CreateIndex
CREATE INDEX "AiCourseGenerationJob_status_expiresAt_idx" ON "AiCourseGenerationJob"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseGenerationJob_userId_idempotencyKey_key" ON "AiCourseGenerationJob"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseProgress_certificateId_key" ON "AiCourseProgress"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseProgress_userId_courseId_version_key" ON "AiCourseProgress"("userId", "courseId", "version");


COMMIT;
