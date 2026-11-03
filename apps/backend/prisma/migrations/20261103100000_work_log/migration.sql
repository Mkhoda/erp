-- Work log (ثبت عملکرد شخصی): categories, tasks, per-user completion, daily time entries, daily reports, settings.
-- CreateTable
CREATE TABLE "WorkLogCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "userId" TEXT,
    "createdById" TEXT,
    "isAdminDefined" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "userId" TEXT,
    "createdById" TEXT,
    "isAdminDefined" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTaskEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "jYear" INTEGER NOT NULL,
    "jMonth" INTEGER NOT NULL,
    "jDay" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTaskEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "jYear" INTEGER NOT NULL,
    "jMonth" INTEGER NOT NULL,
    "jDay" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLogSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 0,
    "capByAttendance" BOOLEAN NOT NULL DEFAULT true,
    "requireOnNonWorkingDays" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkLogCategory_userId_archived_idx" ON "WorkLogCategory"("userId", "archived");

-- CreateIndex
CREATE INDEX "WorkTask_userId_archived_idx" ON "WorkTask"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "WorkTaskCompletion_taskId_userId_key" ON "WorkTaskCompletion"("taskId", "userId");

-- CreateIndex
CREATE INDEX "WorkTaskEntry_userId_gregDate_idx" ON "WorkTaskEntry"("userId", "gregDate");

-- CreateIndex
CREATE INDEX "WorkTaskEntry_taskId_idx" ON "WorkTaskEntry"("taskId");

-- CreateIndex
CREATE INDEX "DailyWorkReport_jYear_jMonth_idx" ON "DailyWorkReport"("jYear", "jMonth");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkReport_userId_gregDate_key" ON "DailyWorkReport"("userId", "gregDate");

-- AddForeignKey
ALTER TABLE "WorkLogCategory" ADD CONSTRAINT "WorkLogCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLogCategory" ADD CONSTRAINT "WorkLogCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WorkLogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskCompletion" ADD CONSTRAINT "WorkTaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskCompletion" ADD CONSTRAINT "WorkTaskCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskEntry" ADD CONSTRAINT "WorkTaskEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskEntry" ADD CONSTRAINT "WorkTaskEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReport" ADD CONSTRAINT "DailyWorkReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Seed: settings singleton + default global categories/tasks (editable/removable by admins) ──
INSERT INTO "WorkLogSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkLogCategory" ("id", "name", "color", "isAdminDefined", "sortOrder", "updatedAt") VALUES
  ('wlc_general',  'عمومی',               '#3b82f6', true, 1, CURRENT_TIMESTAMP),
  ('wlc_meetings', 'جلسات',               '#8b5cf6', true, 2, CURRENT_TIMESTAMP),
  ('wlc_support',  'پشتیبانی و پاسخگویی', '#06b6d4', true, 3, CURRENT_TIMESTAMP),
  ('wlc_learning', 'آموزش و یادگیری',     '#10b981', true, 4, CURRENT_TIMESTAMP),
  ('wlc_admin',    'امور اداری',          '#f59e0b', true, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkTask" ("id", "title", "description", "categoryId", "isAdminDefined", "recurring", "startDate", "updatedAt") VALUES
  ('wlt_daily_report', 'ثبت عملکرد روزانه',         'ثبت وظایف و گزارش کار روزانه در سامانه', 'wlc_general',  true, true, CURRENT_DATE, CURRENT_TIMESTAMP),
  ('wlt_meetings',     'جلسات کاری',                NULL, 'wlc_meetings', true, true, CURRENT_DATE, CURRENT_TIMESTAMP),
  ('wlt_messages',     'پاسخ به ایمیل و پیام‌ها',   NULL, 'wlc_support',  true, true, CURRENT_DATE, CURRENT_TIMESTAMP),
  ('wlt_support',      'پشتیبانی همکاران',          NULL, 'wlc_support',  true, true, CURRENT_DATE, CURRENT_TIMESTAMP),
  ('wlt_learning',     'آموزش و مطالعه',            NULL, 'wlc_learning', true, true, CURRENT_DATE, CURRENT_TIMESTAMP),
  ('wlt_admin',        'امور اداری و مستندسازی',    NULL, 'wlc_admin',    true, true, CURRENT_DATE, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Register the new pages so the sidebar shows them without a manual "sync pages".
INSERT INTO "Page" ("id", "path", "label", "isActive", "updatedAt") VALUES
  ('page_worklog_my',      '/dashboard/work-log/my',      'عملکرد من',          true, CURRENT_TIMESTAMP),
  ('page_worklog_reports', '/dashboard/work-log/reports', 'گزارش عملکرد کاربران', true, CURRENT_TIMESTAMP)
ON CONFLICT ("path") DO NOTHING;
