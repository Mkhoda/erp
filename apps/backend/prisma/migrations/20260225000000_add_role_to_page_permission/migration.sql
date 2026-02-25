-- Add role column (default '*' = all roles) and replace unique constraint
ALTER TABLE "PagePermission" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT '*';

-- Drop old unique index
DROP INDEX IF EXISTS "PagePermission_departmentId_page_key";

-- Create new unique index on (departmentId, page, role)
CREATE UNIQUE INDEX IF NOT EXISTS "PagePermission_departmentId_page_role_key"
  ON "PagePermission"("departmentId", "page", "role");
