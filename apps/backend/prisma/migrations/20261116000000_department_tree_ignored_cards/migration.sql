-- Department tree + per-membership role, and attendance cards removed on purpose.
-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserDepartment" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "IgnoredAttendanceCard" (
    "cardNo" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredAttendanceCard_pkey" PRIMARY KEY ("cardNo")
);

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The primary department (User.departmentId) is also a membership, so the tree shows everyone.
INSERT INTO "UserDepartment" ("userId", "departmentId", "createdAt")
SELECT u."id", u."departmentId", CURRENT_TIMESTAMP FROM "User" u WHERE u."departmentId" IS NOT NULL
ON CONFLICT ("userId", "departmentId") DO NOTHING;
