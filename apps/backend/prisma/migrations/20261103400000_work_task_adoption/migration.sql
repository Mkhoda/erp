-- Global work-log tasks become opt-in per user ("my tasks" list).
-- CreateTable
CREATE TABLE "WorkTaskAdoption" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkTaskAdoption_taskId_userId_key" ON "WorkTaskAdoption"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "WorkTaskAdoption" ADD CONSTRAINT "WorkTaskAdoption_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskAdoption" ADD CONSTRAINT "WorkTaskAdoption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep what people already see: every global task a user has logged time on stays in their
-- list, and the default "ثبت عملکرد روزانه" task is adopted for every active user.
INSERT INTO "WorkTaskAdoption" ("id", "taskId", "userId", "createdAt")
SELECT DISTINCT ON (e."taskId", e."userId") 'wta_' || md5(e."taskId" || e."userId"), e."taskId", e."userId", CURRENT_TIMESTAMP
FROM "WorkTaskEntry" e JOIN "WorkTask" t ON t."id" = e."taskId"
WHERE t."userId" IS NULL
ON CONFLICT ("taskId", "userId") DO NOTHING;

INSERT INTO "WorkTaskAdoption" ("id", "taskId", "userId", "createdAt")
SELECT 'wta_' || md5('wlt_daily_report' || u."id"), 'wlt_daily_report', u."id", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."disabled" = false AND EXISTS (SELECT 1 FROM "WorkTask" WHERE "id" = 'wlt_daily_report' AND "archived" = false)
ON CONFLICT ("taskId", "userId") DO NOTHING;
