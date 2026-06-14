-- Add rawResponse column to AiUsage for debugging
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "rawResponse" TEXT;

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

CREATE INDEX IF NOT EXISTS "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RequestLog_path_idx"      ON "RequestLog"("path");
CREATE INDEX IF NOT EXISTS "RequestLog_statusCode_idx" ON "RequestLog"("statusCode");
