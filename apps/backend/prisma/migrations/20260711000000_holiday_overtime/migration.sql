-- Holiday overtime: separate column to track work done on official holidays
-- (calculated at a different pay rate than regular overtime).
ALTER TABLE "AttendanceDay" ADD COLUMN IF NOT EXISTS "holidayOvertimeMinutes" INTEGER NOT NULL DEFAULT 0;
