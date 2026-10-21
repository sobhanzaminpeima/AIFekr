-- Persist the timer configuration and server-issued attempt start timestamp.
ALTER TABLE "StudentQuiz" ADD COLUMN "timeLimitSeconds" INTEGER;
ALTER TABLE "StudentQuizAttempt" ADD COLUMN "startedAt" DATETIME;
