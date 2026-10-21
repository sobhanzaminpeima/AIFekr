CREATE TABLE "StudentCourse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "instructor" TEXT,
  "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#f97316',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentCourse_userId_updatedAt_idx" ON "StudentCourse"("userId", "updatedAt");

CREATE TABLE "StudentMaterial" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'text',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentMaterial_userId_courseId_createdAt_idx" ON "StudentMaterial"("userId", "courseId", "createdAt");

CREATE TABLE "StudentNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentNote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentNote_userId_courseId_updatedAt_idx" ON "StudentNote"("userId", "courseId", "updatedAt");

CREATE TABLE "StudentFlashcard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentFlashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentFlashcard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentFlashcard_userId_courseId_createdAt_idx" ON "StudentFlashcard"("userId", "courseId", "createdAt");

CREATE TABLE "StudentQuiz" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "questions" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentQuiz_courseId_createdAt_idx" ON "StudentQuiz"("courseId", "createdAt");

CREATE TABLE "StudentQuizAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "answers" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "weakTopics" TEXT,
  "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentQuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "StudentQuiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentQuizAttempt_userId_completedAt_idx" ON "StudentQuizAttempt"("userId", "completedAt");
CREATE INDEX "StudentQuizAttempt_quizId_completedAt_idx" ON "StudentQuizAttempt"("quizId", "completedAt");

CREATE TABLE "StudentExam" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "examAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "StudentCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentExam_userId_examAt_idx" ON "StudentExam"("userId", "examAt");
CREATE INDEX "StudentExam_courseId_examAt_idx" ON "StudentExam"("courseId", "examAt");
