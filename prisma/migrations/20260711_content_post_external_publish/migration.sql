-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN "externalStatus" TEXT NOT NULL DEFAULT 'not_published';
ALTER TABLE "ContentPost" ADD COLUMN "externalUrl" TEXT;
ALTER TABLE "ContentPost" ADD COLUMN "externalError" TEXT;
