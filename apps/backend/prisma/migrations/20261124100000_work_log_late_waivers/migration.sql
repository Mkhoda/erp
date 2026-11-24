-- AlterTable
ALTER TABLE "WorkTaskEntry" ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "enteredById" TEXT;

-- CreateTable
CREATE TABLE "WorkLogLateWaiver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gregDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLogLateWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogLateWaiver_userId_gregDate_key" ON "WorkLogLateWaiver"("userId", "gregDate");

-- AddForeignKey
ALTER TABLE "WorkLogLateWaiver" ADD CONSTRAINT "WorkLogLateWaiver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

