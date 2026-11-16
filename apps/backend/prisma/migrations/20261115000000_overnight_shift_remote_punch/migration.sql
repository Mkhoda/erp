-- Overnight shift days (manual + per-group auto-detect), per-user "no time window", and remote time only for remote days with punches.
-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "autoOvernightShift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserAttendanceRule" ADD COLUMN     "noTimeWindow" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AttendanceShiftDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceShiftDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceShiftDay_userId_gregDate_key" ON "AttendanceShiftDay"("userId", "gregDate");

-- AddForeignKey
ALTER TABLE "AttendanceShiftDay" ADD CONSTRAINT "AttendanceShiftDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Remote time now counts only on remote-work days the person actually came in (both punches),
-- and equals their present hours. Fix stored rows so totals are right before any recompute:
-- no-punch remote days lose their remote time; punched ones keep the same OT share, rescaled.
UPDATE "AttendanceDay"
SET "remoteOvertimeMinutes" = CASE WHEN "remoteMinutes" > 0
      THEN ROUND("remoteOvertimeMinutes"::numeric * "workedMinutes" / "remoteMinutes")::int ELSE 0 END,
    "remoteMinutes" = "workedMinutes"
WHERE "status" = 'REMOTE_WORK' AND "firstCheckIn" IS NOT NULL AND "lastCheckOut" IS NOT NULL;

UPDATE "AttendanceDay" SET "remoteMinutes" = 0, "remoteOvertimeMinutes" = 0
WHERE "status" = 'REMOTE_WORK' AND ("firstCheckIn" IS NULL OR "lastCheckOut" IS NULL);
