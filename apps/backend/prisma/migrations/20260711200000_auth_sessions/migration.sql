-- Migration: Auth Sessions, AuthSettings, AuditLog
-- Adds session tracking, configurable auth settings, and security audit log.

-- 1. Add tokenVersion to User
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;

-- 2. Session table
CREATE TABLE "Session" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "issuedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "lastSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress"      TEXT,
    "userAgent"      TEXT,
    "deviceType"     TEXT,
    "deviceModel"    TEXT,
    "browser"        TEXT,
    "browserVersion" TEXT,
    "os"             TEXT,
    "platform"       TEXT,
    "authMethod"     TEXT NOT NULL DEFAULT 'password',
    "rememberMe"     BOOLEAN NOT NULL DEFAULT false,
    "isRevoked"      BOOLEAN NOT NULL DEFAULT false,
    "revokedAt"      TIMESTAMP(3),
    "revokedById"    TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_isRevoked_expiresAt_idx" ON "Session"("isRevoked", "expiresAt");
CREATE INDEX "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. AuthSettings singleton table
CREATE TABLE "AuthSettings" (
    "id"                    TEXT NOT NULL DEFAULT 'singleton',
    "accessTokenTtlSec"     INTEGER NOT NULL DEFAULT 86400,
    "rememberMeTtlSec"      INTEGER NOT NULL DEFAULT 2592000,
    "idleTimeoutSec"        INTEGER NOT NULL DEFAULT 0,
    "maxSessionLifetimeSec" INTEGER NOT NULL DEFAULT 0,
    "globalTokenVersion"    INTEGER NOT NULL DEFAULT 1,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById"           TEXT,

    CONSTRAINT "AuthSettings_pkey" PRIMARY KEY ("id")
);

-- 4. AuditLog table
CREATE TABLE "AuditLog" (
    "id"        TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"    TEXT,
    "adminId"   TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action"    TEXT NOT NULL,
    "result"    TEXT NOT NULL DEFAULT 'SUCCESS',
    "details"   JSONB,
    "sessionId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
