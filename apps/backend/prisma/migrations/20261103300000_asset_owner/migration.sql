-- تعلق: organizations/companies an asset belongs to, managed dynamically from the assets page.
CREATE TABLE IF NOT EXISTS "AssetOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetOwner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetOwner_name_key" ON "AssetOwner"("name");

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AssetOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Asset_ownerId_idx" ON "Asset"("ownerId");
