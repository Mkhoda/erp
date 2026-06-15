-- Remove all wildcard (*) permission rows created by syncDefaults.
-- From now on, access must be explicitly granted per role via the access page.
-- BASE_PAGES (/dashboard, /dashboard/profile, etc.) are always accessible in code and don't need DB rows.
DELETE FROM "PagePermission" WHERE role = '*';
