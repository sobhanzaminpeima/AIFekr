-- CreateTable: ProviderFallbackLog
-- Tracks every time the AI router falls back from one provider to another.
CREATE TABLE IF NOT EXISTS "ProviderFallbackLog" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "fromProvider" TEXT NOT NULL,
    "toProvider"   TEXT,
    "reason"       TEXT NOT NULL,
    "category"     TEXT NOT NULL DEFAULT 'general',
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for the admin dashboard query (last 24h, grouped by provider)
CREATE INDEX IF NOT EXISTS "ProviderFallbackLog_createdAt_idx"
    ON "ProviderFallbackLog"("createdAt");

CREATE INDEX IF NOT EXISTS "ProviderFallbackLog_fromProvider_idx"
    ON "ProviderFallbackLog"("fromProvider");
