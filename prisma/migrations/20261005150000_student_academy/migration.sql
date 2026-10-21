BEGIN IMMEDIATE;
-- CreateTable
CREATE TABLE "AcademicMajor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "faculty" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AcademicSpecialization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "majorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "AcademicSpecialization_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAcademicProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "majorId" TEXT,
    "specializationId" TEXT,
    "educationLevel" TEXT NOT NULL DEFAULT '',
    "institution" TEXT NOT NULL DEFAULT '',
    "faculty" TEXT NOT NULL DEFAULT '',
    "academicYear" INTEGER,
    "expectedGraduationYear" INTEGER,
    "interests" TEXT NOT NULL DEFAULT '[]',
    "learningGoals" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAcademicProfile_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCourseMajor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'PRIMARY',
    "specializationId" TEXT,
    CONSTRAINT "AiCourseMajor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AiCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiCourseMajor_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCourseVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AiCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCourseAssessmentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiCourseCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "score" REAL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiCourseCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completionId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "learningArea" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "skills" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revocationReason" TEXT,
    CONSTRAINT "AiCourseCertificate_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "AiCourseCompletion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyLearningPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "majorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "courses" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "AiCourse" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER';
ALTER TABLE "AiCourse" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "AiCourse" ADD COLUMN "topic" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AiCourse" ADD COLUMN "skills" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AiCourse" ADD COLUMN "prerequisites" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AiCourse" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "AiCourse" ADD COLUMN "configuration" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "AiCourse" ADD COLUMN "blueprint" TEXT;
ALTER TABLE "AiCourse" ADD COLUMN "blueprintApprovedAt" DATETIME;
ALTER TABLE "AiCourseProgress" ADD COLUMN "versionId" TEXT;
ALTER TABLE "AiCourseProgress" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "AiCourseProgress" ADD COLUMN "lastActivityAt" DATETIME;
ALTER TABLE "AiCourseProgress" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "AiCourseProgress" ADD COLUMN "finalPassed" BOOLEAN NOT NULL DEFAULT false;
INSERT INTO "AiCourseVersion" ("id","courseId","version","title","description","language","content","requirements","metadata","publishedAt") SELECT 'legacy-' || "id" || '-' || "version","id","version","title","description","language","content",'{"lessonPercent":100,"quizScore":60,"finalRequired":false,"finalScore":75,"attemptLimit":0}','{}',COALESCE("publishedAt",CURRENT_TIMESTAMP) FROM "AiCourse" WHERE "status"='PUBLISHED' AND "content" IS NOT NULL;
UPDATE "AiCourseProgress" SET "versionId"=(SELECT "id" FROM "AiCourseVersion" WHERE "courseId"="AiCourseProgress"."courseId" AND "version"="AiCourseProgress"."version"),"startedAt"="createdAt","lastActivityAt"="updatedAt","state"=CASE WHEN "completedAt" IS NOT NULL THEN 'LEGACY_COMPLETED' ELSE 'IN_PROGRESS' END;
-- CreateIndex
CREATE UNIQUE INDEX "AcademicMajor_slug_key" ON "AcademicMajor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSpecialization_majorId_name_key" ON "AcademicSpecialization"("majorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseMajor_courseId_majorId_key" ON "AiCourseMajor"("courseId", "majorId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseVersion_courseId_version_key" ON "AiCourseVersion"("courseId", "version");

-- CreateIndex
CREATE INDEX "AiCourseAssessmentAttempt_userId_createdAt_idx" ON "AiCourseAssessmentAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCourseAssessmentAttempt_enrollmentId_assessmentId_idx" ON "AiCourseAssessmentAttempt"("enrollmentId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseAssessmentAttempt_enrollmentId_requestKey_key" ON "AiCourseAssessmentAttempt"("enrollmentId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseCompletion_enrollmentId_key" ON "AiCourseCompletion"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseCertificate_completionId_key" ON "AiCourseCertificate"("completionId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCourseCertificate_verificationCode_key" ON "AiCourseCertificate"("verificationCode");

-- CreateIndex
CREATE INDEX "AiCourseCertificate_status_issuedAt_idx" ON "AiCourseCertificate"("status", "issuedAt");

ALTER TABLE "AiCourseGenerationJob" ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'FULL';
ALTER TABLE "AiCourseGenerationJob" ADD COLUMN "checkpoint" TEXT NOT NULL DEFAULT '{}';
COMMIT;
