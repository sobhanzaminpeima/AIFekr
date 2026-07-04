-- CreateTable: Project (folders for organizing conversations)
-- Already exists on the current production DB (applied manually via SSH
-- before this migration was written) — IF NOT EXISTS keeps this idempotent.
CREATE TABLE IF NOT EXISTS "Project" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "color"       TEXT NOT NULL DEFAULT '#ea580c',
    "icon"        TEXT NOT NULL DEFAULT 'folder',
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

-- NOTE: Conversation.projectId and the User.googleId / User.authProvider
-- columns below use plain ALTER TABLE ADD COLUMN, which SQLite does NOT
-- support with "IF NOT EXISTS". On a fresh database this migration runs
-- top-to-bottom safely. On the existing production DB, Conversation
-- already has projectId (added manually) — apply only the two new User
-- columns there via a guarded script (PRAGMA table_info check) instead of
-- `prisma migrate deploy`, or this statement will error on a duplicate
-- column. See docs/PROJECT_DOCUMENTATION.docx, chapter 12.1.
ALTER TABLE "Conversation" ADD COLUMN "projectId" TEXT REFERENCES "Project"("id");

ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'password';

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
