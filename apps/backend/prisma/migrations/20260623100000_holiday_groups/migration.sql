-- Bind holidays to specific work-schedule groups (empty array = applies to all groups).
ALTER TABLE "Holiday" ADD COLUMN "scheduleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
