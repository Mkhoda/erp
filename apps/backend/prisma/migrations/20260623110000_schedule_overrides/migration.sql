-- Per-group, per-weekday working-hour overrides within a date range.
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "scheduleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "checkInStart" TEXT,
    "checkInEnd" TEXT,
    "checkOutStart" TEXT,
    "checkOutEnd" TEXT,
    "dailyMinutes" INTEGER,
    "lunchMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleOverride_startDate_endDate_idx" ON "ScheduleOverride"("startDate", "endDate");
