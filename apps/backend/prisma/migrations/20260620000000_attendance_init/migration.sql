-- Attendance & Workforce Management — additive migration.
-- Generated via 'prisma migrate diff', stripped of unrelated pre-existing drift
-- (Conversation/UserMemory FK + index, updatedAt/PagePermission default drift).

-- CreateEnum
CREATE TYPE "PunchDirection" AS ENUM ('IN', 'OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'INCOMPLETE', 'LEAVE', 'MISSION', 'REMOTE_WORK', 'HOLIDAY', 'COMPANY_HOLIDAY', 'WEEKEND');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('OFFICIAL', 'COMPANY', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'ROTATING', 'NIGHT', 'WEEKLY_ROTATION', 'MONTHLY_ROTATION', 'TWENTY_FOUR_FORTY_EIGHT');

-- CreateEnum
CREATE TYPE "LeaveKind" AS ENUM ('VACATION', 'SICK', 'MISSION', 'REMOTE_WORK', 'HOURLY');

-- CreateEnum
CREATE TYPE "AttnRequestType" AS ENUM ('CHECK_IN_FIX', 'CHECK_OUT_FIX', 'FULL_DAY_FIX', 'EXPLANATION', 'LEAVE');

-- CreateEnum
CREATE TYPE "AttnRequestStatus" AS ENUM ('PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AttnNotifType" AS ENUM ('MISSING_PUNCH', 'ABSENCE', 'DELAY', 'EXCESSIVE_OVERTIME', 'SYNC_FAILURE', 'DEVICE_OFFLINE');

-- CreateEnum
CREATE TYPE "AttnNotifChannel" AS ENUM ('IN_APP', 'BALE', 'EMAIL');
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "attendanceCardNo" TEXT;

-- CreateTable
CREATE TABLE "AttendanceSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driver" TEXT NOT NULL DEFAULT 'mssql',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 1433,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "tableName" TEXT NOT NULL DEFAULT 'dbo.TimeRecords',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncIntervalSec" INTEGER NOT NULL DEFAULT 300,
    "batchSize" INTEGER NOT NULL DEFAULT 1000,
    "initialSyncDate" TIMESTAMP(3),
    "initialRecordId" INTEGER NOT NULL DEFAULT 0,
    "autoRetry" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "lastRecordId" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "PunchDirection" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSyncLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL,
    "trigger" TEXT NOT NULL,
    "fromRecordId" INTEGER NOT NULL,
    "toRecordId" INTEGER NOT NULL,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawAttendanceRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "cardNo" TEXT NOT NULL,
    "mDate" TEXT,
    "sDate" TEXT,
    "rTime" TEXT,
    "rType" TEXT,
    "deviceCode" TEXT,
    "punchAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "jYear" INTEGER NOT NULL,
    "jMonth" INTEGER NOT NULL,
    "jDay" INTEGER NOT NULL,
    "firstCheckIn" TIMESTAMP(3),
    "lastCheckOut" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL,
    "isHolidayWork" BOOLEAN NOT NULL DEFAULT false,
    "shiftId" TEXT,
    "hasOverride" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "newCheckIn" TIMESTAMP(3),
    "newCheckOut" TIMESTAMP(3),
    "forceStatus" "AttendanceStatus",
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "dailyMinutes" INTEGER NOT NULL DEFAULT 480,
    "weeklyMinutes" INTEGER NOT NULL DEFAULT 2640,
    "lunchMinutes" INTEGER NOT NULL DEFAULT 60,
    "flexEnabled" BOOLEAN NOT NULL DEFAULT false,
    "flexInStart" TEXT DEFAULT '07:30',
    "flexInEnd" TEXT DEFAULT '09:00',
    "graceMinutes" INTEGER NOT NULL DEFAULT 30,
    "workDays" INTEGER[] DEFAULT ARRAY[6, 0, 1, 2, 3]::INTEGER[],
    "otMinThreshold" INTEGER NOT NULL DEFAULT 30,
    "otMaxDaily" INTEGER NOT NULL DEFAULT 240,
    "otMaxMonthly" INTEGER NOT NULL DEFAULT 3600,
    "otRounding" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAttendanceRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "dailyMinutes" INTEGER,
    "graceMinutes" INTEGER,
    "flexEnabled" BOOLEAN,
    "otAllowed" BOOLEAN NOT NULL DEFAULT true,
    "otMaxDaily" INTEGER,
    "otMaxMonthly" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAttendanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "cycleDays" INTEGER,
    "pattern" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCalendarDay" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "isOff" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShiftCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "jMonth" INTEGER,
    "jDay" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LeaveKind" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "attachment" TEXT,
    "status" "AttnRequestStatus" NOT NULL DEFAULT 'PENDING',
    "managerById" TEXT,
    "hrById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttnRequestType" NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "requestedIn" TIMESTAMP(3),
    "requestedOut" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "attachment" TEXT,
    "status" "AttnRequestStatus" NOT NULL DEFAULT 'PENDING',
    "managerById" TEXT,
    "hrById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttnNotifType" NOT NULL,
    "channel" "AttnNotifChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_sourceId_deviceCode_key" ON "AttendanceDevice"("sourceId", "deviceCode");

-- CreateIndex
CREATE INDEX "AttendanceSyncLog_sourceId_startedAt_idx" ON "AttendanceSyncLog"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "RawAttendanceRecord_userId_punchAt_idx" ON "RawAttendanceRecord"("userId", "punchAt");

-- CreateIndex
CREATE INDEX "RawAttendanceRecord_cardNo_punchAt_idx" ON "RawAttendanceRecord"("cardNo", "punchAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawAttendanceRecord_sourceId_recordId_key" ON "RawAttendanceRecord"("sourceId", "recordId");

-- CreateIndex
CREATE INDEX "AttendanceDay_jYear_jMonth_idx" ON "AttendanceDay"("jYear", "jMonth");

-- CreateIndex
CREATE INDEX "AttendanceDay_status_idx" ON "AttendanceDay"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_userId_gregDate_key" ON "AttendanceDay"("userId", "gregDate");

-- CreateIndex
CREATE INDEX "AttendanceOverride_userId_gregDate_idx" ON "AttendanceOverride"("userId", "gregDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_name_key" ON "WorkSchedule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserAttendanceRule_userId_key" ON "UserAttendanceRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_name_key" ON "Shift"("name");

-- CreateIndex
CREATE INDEX "ShiftAssignment_userId_startDate_idx" ON "ShiftAssignment"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCalendarDay_userId_gregDate_key" ON "ShiftCalendarDay"("userId", "gregDate");

-- CreateIndex
CREATE INDEX "Holiday_startDate_endDate_idx" ON "Holiday"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_startDate_idx" ON "LeaveRequest"("userId", "startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "AttendanceRequest_userId_gregDate_idx" ON "AttendanceRequest"("userId", "gregDate");

-- CreateIndex
CREATE INDEX "AttendanceRequest_status_idx" ON "AttendanceRequest"("status");

-- CreateIndex
CREATE INDEX "AttendanceNotification_userId_isRead_idx" ON "AttendanceNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_attendanceCardNo_key" ON "User"("attendanceCardNo");

-- AddForeignKey
ALTER TABLE "AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AttendanceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSyncLog" ADD CONSTRAINT "AttendanceSyncLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AttendanceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawAttendanceRecord" ADD CONSTRAINT "RawAttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceOverride" ADD CONSTRAINT "AttendanceOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAttendanceRule" ADD CONSTRAINT "UserAttendanceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAttendanceRule" ADD CONSTRAINT "UserAttendanceRule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCalendarDay" ADD CONSTRAINT "ShiftCalendarDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNotification" ADD CONSTRAINT "AttendanceNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

