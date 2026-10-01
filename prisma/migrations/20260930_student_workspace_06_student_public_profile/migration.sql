ALTER TABLE "User" ADD COLUMN "studentPublicSlug" TEXT;
ALTER TABLE "User" ADD COLUMN "studentProfilePublic" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_studentPublicSlug_key" ON "User"("studentPublicSlug");
