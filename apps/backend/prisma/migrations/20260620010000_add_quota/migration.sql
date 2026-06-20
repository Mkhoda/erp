-- CreateTable: per-user token quota per AI provider
CREATE TABLE "UserQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform-wide default quotas
CREATE TABLE "DefaultQuota" (
    "id" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefaultQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserQuota_userId_providerType_key" ON "UserQuota"("userId", "providerType");
CREATE INDEX "UserQuota_userId_idx" ON "UserQuota"("userId");
CREATE INDEX "UserQuota_providerType_idx" ON "UserQuota"("providerType");
CREATE UNIQUE INDEX "DefaultQuota_providerType_key" ON "DefaultQuota"("providerType");

-- AddForeignKey
ALTER TABLE "UserQuota" ADD CONSTRAINT "UserQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
