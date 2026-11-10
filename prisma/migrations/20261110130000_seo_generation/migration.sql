-- Saved results of the paid SEO tools. Additive: one new table only.
-- CreateTable
CREATE TABLE "SeoGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "keyword" TEXT,
    "url" TEXT,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeoGeneration_userId_createdAt_idx" ON "SeoGeneration"("userId", "createdAt");
