-- Hand-written (not `prisma migrate diff` output) — plain CREATE TABLE,
-- same convention as the other hand-written migrations in this project.

CREATE TABLE "CustomAiProvider" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "baseUrl"   TEXT NOT NULL,
  "apiKey"    TEXT NOT NULL,
  "model"     TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
