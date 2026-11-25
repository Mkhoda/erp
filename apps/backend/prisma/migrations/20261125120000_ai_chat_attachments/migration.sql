-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "stopped" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConversationAttachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "policy" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationAttachment_userId_createdAt_idx" ON "ConversationAttachment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationAttachment_messageId_idx" ON "ConversationAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "ConversationAttachment" ADD CONSTRAINT "ConversationAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAttachment" ADD CONSTRAINT "ConversationAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

