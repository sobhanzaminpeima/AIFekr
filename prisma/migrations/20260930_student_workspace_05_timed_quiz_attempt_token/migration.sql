-- Enforce single-use timer tokens at the database boundary under concurrent submits.
ALTER TABLE "StudentQuizAttempt" ADD COLUMN "attemptToken" TEXT;
CREATE UNIQUE INDEX "StudentQuizAttempt_attemptToken_key" ON "StudentQuizAttempt"("attemptToken");
