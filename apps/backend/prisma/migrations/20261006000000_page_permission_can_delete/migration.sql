-- Per-action page permissions: canRead = view, canWrite = create/edit, canDelete = delete.
ALTER TABLE "PagePermission" ADD COLUMN IF NOT EXISTS "canDelete" BOOLEAN NOT NULL DEFAULT false;

-- Asset endpoints are now gated by these flags instead of hardcoded roles. Keep the
-- previous behaviour for managers (who could create/edit) on pages they can already see.
UPDATE "PagePermission" SET "canWrite" = true
WHERE "canRead" = true AND "role" = 'MANAGER'
  AND "page" IN ('/dashboard/assets', '/dashboard/assets/types', '/dashboard/assets/categories', '/dashboard/assets/assignments');
