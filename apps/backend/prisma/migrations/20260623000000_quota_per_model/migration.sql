-- Switch quota keying from providerType (shared across models of a type)
-- to providerId (per configured AiProvider / model).

-- Existing quota rows cannot be reliably mapped to a specific model,
-- so they are cleared; they are recreated on demand from defaults.
DELETE FROM "UserQuota";
DELETE FROM "DefaultQuota";

-- ── UserQuota: providerType -> providerId ────────────────────────────────
DROP INDEX IF EXISTS "UserQuota_userId_providerType_key";
DROP INDEX IF EXISTS "UserQuota_providerType_idx";

ALTER TABLE "UserQuota" DROP COLUMN "providerType";
ALTER TABLE "UserQuota" ADD COLUMN "providerId" TEXT NOT NULL;

CREATE UNIQUE INDEX "UserQuota_userId_providerId_key" ON "UserQuota"("userId", "providerId");
CREATE INDEX "UserQuota_providerId_idx" ON "UserQuota"("providerId");

ALTER TABLE "UserQuota"
  ADD CONSTRAINT "UserQuota_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── DefaultQuota: providerType -> providerId ─────────────────────────────
DROP INDEX IF EXISTS "DefaultQuota_providerType_key";

ALTER TABLE "DefaultQuota" DROP COLUMN "providerType";
ALTER TABLE "DefaultQuota" ADD COLUMN "providerId" TEXT NOT NULL;

CREATE UNIQUE INDEX "DefaultQuota_providerId_key" ON "DefaultQuota"("providerId");

ALTER TABLE "DefaultQuota"
  ADD CONSTRAINT "DefaultQuota_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
