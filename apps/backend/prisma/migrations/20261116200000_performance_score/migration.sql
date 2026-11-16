-- Performance score settings + registering the new page.
-- CreateTable
CREATE TABLE "PerformanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "weights" JSONB NOT NULL DEFAULT '{"report":25,"punctuality":25,"attendance":20,"tickets":20,"coverage":10}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceSettings_pkey" PRIMARY KEY ("id")
);


INSERT INTO "PerformanceSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Page" ("id", "path", "label", "isActive", "updatedAt") VALUES
  ('page_performance', '/dashboard/performance', 'امتیاز عملکرد', true, CURRENT_TIMESTAMP)
ON CONFLICT ("path") DO NOTHING;
