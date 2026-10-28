-- AlterTable (additive)
ALTER TABLE "GrowthProfile" ADD COLUMN "workspaces" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GrowthProfile" ADD COLUMN "activeWorkspace" TEXT;
