CREATE TABLE "MobileRequest" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "inputHash" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RUNNING',
 "responseJson" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "MobileRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobileRequest_userId_requestKey_key" ON "MobileRequest"("userId", "requestKey");
CREATE INDEX "MobileRequest_status_createdAt_idx" ON "MobileRequest"("status", "createdAt");
