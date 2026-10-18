-- CreateTable
CREATE TABLE "VideoFactoryProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "manifest" TEXT NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "activeJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoFactoryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "manifest" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFactoryVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'SCRIPTING',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" TEXT NOT NULL DEFAULT '{}',
    "policy" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "spentCredits" INTEGER NOT NULL DEFAULT 0,
    "usageLogId" TEXT NOT NULL,
    "payerTeamId" TEXT,
    "mirroredAi" REAL NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" DATETIME,
    "errorCode" TEXT,
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoFactoryJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoFactoryProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "output" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "VideoFactoryStep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VideoFactoryJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoFactoryArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFactoryArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VideoFactoryJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoFactoryProject_userId_updatedAt_idx" ON "VideoFactoryProject"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryVersion_projectId_version_key" ON "VideoFactoryVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryJob_usageLogId_key" ON "VideoFactoryJob"("usageLogId");

-- CreateIndex
CREATE INDEX "VideoFactoryJob_status_leaseUntil_createdAt_idx" ON "VideoFactoryJob"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE INDEX "VideoFactoryJob_projectId_createdAt_idx" ON "VideoFactoryJob"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryJob_userId_idempotencyKey_key" ON "VideoFactoryJob"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryStep_jobId_key_key" ON "VideoFactoryStep"("jobId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFactoryArtifact_jobId_kind_key" ON "VideoFactoryArtifact"("jobId", "kind");
