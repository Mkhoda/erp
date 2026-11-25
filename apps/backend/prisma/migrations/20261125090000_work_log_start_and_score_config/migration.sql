-- Work log officially starts on 1 Azar 1405; configurable score indicators.
-- AlterTable
ALTER TABLE "PerformanceSettings" ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "WorkLogSettings" ADD COLUMN     "startDate" TIMESTAMP(3);

INSERT INTO "WorkLogSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
UPDATE "WorkLogSettings" SET "startDate" = '2026-11-22 00:00:00' WHERE "id" = 'singleton';

INSERT INTO "Page" ("id", "path", "label", "isActive", "updatedAt") VALUES
  ('page_performance_settings', '/dashboard/performance/settings', 'شاخص‌های امتیاز عملکرد', true, CURRENT_TIMESTAMP)
ON CONFLICT ("path") DO NOTHING;
