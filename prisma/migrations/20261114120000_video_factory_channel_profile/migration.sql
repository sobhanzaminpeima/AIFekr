-- Video Factory channel details typed in by the owner. Additive: one new table.
-- CreateTable
CREATE TABLE "VideoFactoryChannelProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "niche" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'fa',
    "tone" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
