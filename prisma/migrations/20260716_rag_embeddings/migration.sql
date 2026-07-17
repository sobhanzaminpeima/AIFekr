-- Add embedding columns for semantic retrieval (RAG)
ALTER TABLE "ContentAgentLesson" ADD COLUMN "embedding" TEXT;
ALTER TABLE "BusinessMemory" ADD COLUMN "embedding" TEXT;
