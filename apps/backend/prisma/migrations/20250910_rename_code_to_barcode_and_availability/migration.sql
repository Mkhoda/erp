-- Deterministic migration to align DB with updated Prisma schema
-- Assumes previous migrations in this project have been applied to a shadow database.

-- 1) New enums used by Asset
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'USED_GOOD', 'DEFECTIVE');
CREATE TYPE "AssetAvailability" AS ENUM ('AVAILABLE', 'IN_USE', 'CONSUMED', 'MAINTENANCE', 'RETIRED', 'LOST');

-- 2) AssetType table referenced by Asset
CREATE TABLE "AssetType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetType_name_key" ON "AssetType"("name");

-- 3) Evolve Asset columns
ALTER TABLE "Asset" ADD COLUMN "barcode" TEXT;
ALTER TABLE "Asset" ADD COLUMN "oldBarcode" TEXT;
ALTER TABLE "Asset" ADD COLUMN "typeId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "condition" "AssetCondition";
ALTER TABLE "Asset" ADD COLUMN "availability" "AssetAvailability" DEFAULT 'AVAILABLE';
ALTER TABLE "Asset" ADD COLUMN "consumedAt" TIMESTAMP(3);

-- 4) Backfill from legacy columns
UPDATE "Asset" SET "barcode" = "code" WHERE "barcode" IS NULL;
UPDATE "Asset" SET "availability" = 
  CASE "status"
    WHEN 'AVAILABLE' THEN 'AVAILABLE'::"AssetAvailability"
    WHEN 'IN_USE' THEN 'IN_USE'::"AssetAvailability"
    WHEN 'MAINTENANCE' THEN 'MAINTENANCE'::"AssetAvailability"
    WHEN 'RETIRED' THEN 'RETIRED'::"AssetAvailability"
    WHEN 'LOST' THEN 'LOST'::"AssetAvailability"
    ELSE 'AVAILABLE'::"AssetAvailability"
  END
WHERE "status" IS NOT NULL;
UPDATE "Asset" SET "condition" = 'USED_GOOD'::"AssetCondition" WHERE "condition" IS NULL;

-- 5) Constraints & indexes
ALTER TABLE "Asset" ALTER COLUMN "barcode" SET NOT NULL;
CREATE UNIQUE INDEX "Asset_barcode_key" ON "Asset"("barcode");
DROP INDEX IF EXISTS "Asset_code_key";

-- 6) Seed default AssetType and set FK
INSERT INTO "AssetType" ("id","name","description","updatedAt")
VALUES ('generic','Generic','Default type', NOW())
ON CONFLICT ("name") DO NOTHING;
UPDATE "Asset" SET "typeId" = 'generic' WHERE "typeId" IS NULL;
ALTER TABLE "Asset" ALTER COLUMN "typeId" SET NOT NULL;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7) Drop old status column and enum (no longer used)
ALTER TABLE "Asset" DROP COLUMN "status";
DROP TYPE "AssetStatus";

-- 8) Ensure AssetImage FK cascades on delete
ALTER TABLE "AssetImage" DROP CONSTRAINT "AssetImage_assetId_fkey";
ALTER TABLE "AssetImage" ADD CONSTRAINT "AssetImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
