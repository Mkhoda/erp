-- Separate "create" flag (for pages whose API distinguishes create from edit) and per-person page grants.
ALTER TABLE "PagePermission" ADD COLUMN IF NOT EXISTS "canCreate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UserPagePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPagePermission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserPagePermission_page_idx" ON "UserPagePermission"("page");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPagePermission_userId_page_key" ON "UserPagePermission"("userId", "page");

ALTER TABLE "UserPagePermission" ADD CONSTRAINT "UserPagePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPagePermission" ADD CONSTRAINT "UserPagePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Attendance records: editing a day (detail modal) and manual check-in/out entry are now gated by
-- the page's canWrite / canCreate flags instead of a hardcoded ADMIN/MANAGER role check. Keep what
-- managers could already do on departments where they can see the page; other roles start view-only.
UPDATE "PagePermission" SET "canWrite" = true, "canCreate" = true
WHERE "page" = '/dashboard/attendance/records' AND "role" = 'MANAGER' AND "canRead" = true;

INSERT INTO "PagePermission" ("id", "departmentId", "page", "role", "canRead", "canWrite", "canDelete", "canCreate", "createdAt", "updatedAt")
SELECT 'pp_' || md5(random()::text || clock_timestamp()::text || w."departmentId"), w."departmentId", w."page", 'MANAGER', true, true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PagePermission" w
WHERE w."page" = '/dashboard/attendance/records' AND w."role" = '*' AND w."canRead" = true
ON CONFLICT ("departmentId", "page", "role") DO NOTHING;

-- New admin metrics dashboard: registered so it shows in the menu once granted (ADMIN sees it always).
INSERT INTO "Page" ("id", "path", "label", "isActive", "updatedAt") VALUES
  ('page_analytics', '/dashboard/analytics', 'داشبورد مدیریتی', true, CURRENT_TIMESTAMP)
ON CONFLICT ("path") DO NOTHING;
