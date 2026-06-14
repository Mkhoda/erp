-- Create AiUsage table if it does not exist yet
CREATE TABLE IF NOT EXISTS "AiUsage" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "providerType"     TEXT NOT NULL,
    "model"            TEXT,
    "prompt"           TEXT NOT NULL,
    "promptTokens"     INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens"      INTEGER NOT NULL DEFAULT 0,
    "latencyMs"        INTEGER NOT NULL DEFAULT 0,
    "success"          BOOLEAN NOT NULL DEFAULT true,
    "errorMsg"         TEXT,
    "rawResponse"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- Foreign key to User (only add if table was just created and FK doesn't exist)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AiUsage_userId_fkey'
    ) THEN
        ALTER TABLE "AiUsage"
            ADD CONSTRAINT "AiUsage_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Add rawResponse column if AiUsage already existed without it
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "rawResponse" TEXT;

-- Indexes on AiUsage
CREATE INDEX IF NOT EXISTS "AiUsage_userId_idx"       ON "AiUsage"("userId");
CREATE INDEX IF NOT EXISTS "AiUsage_providerType_idx" ON "AiUsage"("providerType");
CREATE INDEX IF NOT EXISTS "AiUsage_createdAt_idx"    ON "AiUsage"("createdAt");

-- Create RequestLog table
CREATE TABLE IF NOT EXISTS "RequestLog" (
    "id"         TEXT NOT NULL,
    "method"     TEXT NOT NULL,
    "path"       TEXT NOT NULL,
    "statusCode" INTEGER,
    "userId"     TEXT,
    "body"       TEXT,
    "response"   TEXT,
    "latencyMs"  INTEGER,
    "errorMsg"   TEXT,
    "ip"         TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequestLog_createdAt_idx"  ON "RequestLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RequestLog_path_idx"       ON "RequestLog"("path");
CREATE INDEX IF NOT EXISTS "RequestLog_statusCode_idx" ON "RequestLog"("statusCode");
