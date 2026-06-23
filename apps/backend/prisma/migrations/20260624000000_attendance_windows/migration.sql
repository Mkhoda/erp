-- Window-based attendance (check-in/out windows) on schedules + per-user rules.
ALTER TABLE "WorkSchedule" ADD COLUMN "checkInStart" TEXT NOT NULL DEFAULT '06:30';
ALTER TABLE "WorkSchedule" ADD COLUMN "checkInEnd" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "WorkSchedule" ADD COLUMN "checkOutStart" TEXT NOT NULL DEFAULT '14:50';
ALTER TABLE "WorkSchedule" ADD COLUMN "checkOutEnd" TEXT NOT NULL DEFAULT '17:20';
ALTER TABLE "UserAttendanceRule" ADD COLUMN "checkInStart" TEXT;
ALTER TABLE "UserAttendanceRule" ADD COLUMN "checkInEnd" TEXT;
ALTER TABLE "UserAttendanceRule" ADD COLUMN "checkOutStart" TEXT;
ALTER TABLE "UserAttendanceRule" ADD COLUMN "checkOutEnd" TEXT;
