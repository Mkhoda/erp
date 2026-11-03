-- Remote-work time per day, and the per-group share of it reported as overtime-equivalent.
ALTER TABLE "AttendanceDay" ADD COLUMN IF NOT EXISTS "remoteMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AttendanceDay" ADD COLUMN IF NOT EXISTS "remoteOvertimeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkSchedule" ADD COLUMN IF NOT EXISTS "remoteOtPercent" INTEGER NOT NULL DEFAULT 0;

-- Backfill remoteMinutes for existing REMOTE_WORK days from each user's group (or the
-- default group) so totals show immediately; remoteOvertimeMinutes stays 0 because every
-- group starts at 0%, and any later change to the percentage recomputes the group's users.
UPDATE "AttendanceDay" d
SET "remoteMinutes" = COALESCE(
  (SELECT COALESCE(r."dailyMinutes", ws."dailyMinutes")
     FROM "UserAttendanceRule" r LEFT JOIN "WorkSchedule" ws ON ws."id" = r."scheduleId"
    WHERE r."userId" = d."userId"),
  (SELECT ws."dailyMinutes" FROM "WorkSchedule" ws ORDER BY ws."isDefault" DESC, (ws."name" = 'default') DESC LIMIT 1),
  500)
WHERE d."status" = 'REMOTE_WORK' AND d."remoteMinutes" = 0;
