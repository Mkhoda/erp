-- Per-user employee classification (full-time vs hourly).
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'HOURLY');
ALTER TABLE "UserAttendanceRule" ADD COLUMN "employeeType" "EmployeeType" NOT NULL DEFAULT 'FULL_TIME';
