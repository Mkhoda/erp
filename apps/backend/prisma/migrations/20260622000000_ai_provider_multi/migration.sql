-- Allow multiple providers of the same type (remove unique constraint)
DROP INDEX IF EXISTS "AiProvider_type_key";

-- Add providerName to AiUsage for display in reports/logs
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "providerName" TEXT;

-- Migrate existing Conversation.provider (type string) → provider ID
-- Only update rows where provider matches a known type
UPDATE "Conversation" c
SET provider = p.id
FROM "AiProvider" p
WHERE c.provider = p.type;
