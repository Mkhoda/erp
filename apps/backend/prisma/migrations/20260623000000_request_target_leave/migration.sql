-- Leave/mission target status on correction requests + annual leave entitlement.
ALTER TABLE "AttendanceRequest" ADD COLUMN "targetStatus" "AttendanceStatus";
ALTER TABLE "WorkSchedule" ADD COLUMN "annualLeaveDays" INTEGER NOT NULL DEFAULT 26;
