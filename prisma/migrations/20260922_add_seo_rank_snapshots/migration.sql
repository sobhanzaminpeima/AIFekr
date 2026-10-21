-- CreateTable
CREATE TABLE "SeoRankSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" REAL NOT NULL,
    "position" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoRankSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SeoSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeoRankSnapshot_siteId_date_idx" ON "SeoRankSnapshot"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SeoRankSnapshot_siteId_date_query_key" ON "SeoRankSnapshot"("siteId", "date", "query");

