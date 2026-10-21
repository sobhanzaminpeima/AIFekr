CREATE TABLE IF NOT EXISTS "StudentStudyGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStudyGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentStudyGroup_inviteCode_key" ON "StudentStudyGroup"("inviteCode");
CREATE INDEX IF NOT EXISTS "StudentStudyGroup_ownerId_createdAt_idx" ON "StudentStudyGroup"("ownerId", "createdAt");

CREATE TABLE IF NOT EXISTS "StudentStudyGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentStudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentStudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentStudyGroupMember_groupId_userId_key" ON "StudentStudyGroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "StudentStudyGroupMember_userId_joinedAt_idx" ON "StudentStudyGroupMember"("userId", "joinedAt");

CREATE TABLE IF NOT EXISTS "StudentStudyGroupMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStudyGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentStudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentStudyGroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentStudyGroupMessage_groupId_createdAt_idx" ON "StudentStudyGroupMessage"("groupId", "createdAt");
