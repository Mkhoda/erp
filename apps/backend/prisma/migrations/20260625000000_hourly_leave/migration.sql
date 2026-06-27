-- Hourly leave: leave minutes on day/override/request.
ALTER TABLE "AttendanceDay" ADD COLUMN "leaveMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AttendanceOverride" ADD COLUMN "leaveMinutes" INTEGER;
ALTER TABLE "AttendanceRequest" ADD COLUMN "leaveMinutes" INTEGER;
