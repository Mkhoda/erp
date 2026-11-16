-- Fixed priority of the default global categories: 1 meetings, 2 training, 3 admin, 4 support, 5 general.
UPDATE "WorkLogCategory" SET "sortOrder" = 1 WHERE "id" = 'wlc_meetings';
UPDATE "WorkLogCategory" SET "sortOrder" = 2 WHERE "id" = 'wlc_learning';
UPDATE "WorkLogCategory" SET "sortOrder" = 3 WHERE "id" = 'wlc_admin';
UPDATE "WorkLogCategory" SET "sortOrder" = 4 WHERE "id" = 'wlc_support';
UPDATE "WorkLogCategory" SET "sortOrder" = 5 WHERE "id" = 'wlc_general';

-- A category is now required for every task: existing uncategorized tasks move to "عمومی"
-- (or the first live global category if that one was removed).
UPDATE "WorkTask" SET "categoryId" = COALESCE(
  (SELECT "id" FROM "WorkLogCategory" WHERE "id" = 'wlc_general' AND "archived" = false),
  (SELECT "id" FROM "WorkLogCategory" WHERE "userId" IS NULL AND "archived" = false ORDER BY "sortOrder" LIMIT 1))
WHERE "categoryId" IS NULL;
