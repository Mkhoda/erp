-- The separate attendance dashboard (/dashboard/attendance) and reports page (/dashboard/reports)
-- were merged into /dashboard/analytics and removed: hide them from the page registry and drop
-- their permission rows (a grant on /dashboard/attendance also prefix-matched every attendance page).
UPDATE "Page" SET "isActive" = false WHERE "path" IN ('/dashboard/attendance', '/dashboard/reports');
DELETE FROM "PagePermission" WHERE "page" IN ('/dashboard/attendance', '/dashboard/reports');
DELETE FROM "UserPagePermission" WHERE "page" IN ('/dashboard/attendance', '/dashboard/reports');
