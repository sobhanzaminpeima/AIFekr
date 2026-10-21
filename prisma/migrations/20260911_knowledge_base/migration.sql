-- Knowledge base for the floating support assistant (support_mode).
-- Shared platform documentation, not tenant data: no userId column by design.

CREATE TABLE "KbDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "capabilityKey" TEXT,
    "hash" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "KbDocument_slug_lang_key" ON "KbDocument"("slug", "lang");

CREATE TABLE "KbChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "embedding" TEXT,
    CONSTRAINT "KbChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KbDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KbChunk_documentId_ordinal_idx" ON "KbChunk"("documentId", "ordinal");
