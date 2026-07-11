-- Migration: Internal Real-Time Messaging
-- Adds ChatConversation, ChatMember, ChatMessage, ChatAttachment,
-- ChatReaction, ChatRead, UserPresence, ChatSettings models.

-- 1. Enums
CREATE TYPE "ChatConvType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "ChatMsgType"  AS ENUM ('TEXT','IMAGE','VIDEO','AUDIO','VOICE','DOCUMENT','CODE','LINK','SYSTEM');
CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE','AWAY','BUSY','OFFLINE');

-- 2. ChatConversation
CREATE TABLE "ChatConversation" (
    "id"        TEXT         NOT NULL,
    "type"      "ChatConvType" NOT NULL DEFAULT 'DIRECT',
    "name"      TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatConversation_updatedAt_idx" ON "ChatConversation"("updatedAt");

-- 3. ChatMember
CREATE TABLE "ChatMember" (
    "id"             TEXT         NOT NULL,
    "conversationId" TEXT         NOT NULL,
    "userId"         TEXT         NOT NULL,
    "role"           TEXT         NOT NULL DEFAULT 'MEMBER',
    "lastReadAt"     TIMESTAMP(3),
    "isArchived"     BOOLEAN      NOT NULL DEFAULT false,
    "joinedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatMember_conversationId_userId_key" ON "ChatMember"("conversationId","userId");
CREATE INDEX "ChatMember_userId_idx"         ON "ChatMember"("userId");
CREATE INDEX "ChatMember_conversationId_idx" ON "ChatMember"("conversationId");
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. ChatMessage
CREATE TABLE "ChatMessage" (
    "id"             TEXT         NOT NULL,
    "conversationId" TEXT         NOT NULL,
    "senderId"       TEXT         NOT NULL,
    "type"           "ChatMsgType" NOT NULL DEFAULT 'TEXT',
    "content"        TEXT,
    "isEdited"       BOOLEAN      NOT NULL DEFAULT false,
    "editedAt"       TIMESTAMP(3),
    "isDeleted"      BOOLEAN      NOT NULL DEFAULT false,
    "deletedForAll"  BOOLEAN      NOT NULL DEFAULT false,
    "replyToId"      TEXT,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId","createdAt");
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. ChatAttachment
CREATE TABLE "ChatAttachment" (
    "id"        TEXT         NOT NULL,
    "messageId" TEXT         NOT NULL,
    "type"      "ChatMsgType" NOT NULL DEFAULT 'DOCUMENT',
    "url"       TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "size"      INTEGER      NOT NULL,
    "mimeType"  TEXT,
    "width"     INTEGER,
    "height"    INTEGER,
    "duration"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. ChatReaction
CREATE TABLE "ChatReaction" (
    "messageId" TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "emoji"     TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("messageId","userId","emoji")
);
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. ChatRead
CREATE TABLE "ChatRead" (
    "messageId" TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "readAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("messageId","userId")
);
CREATE INDEX "ChatRead_userId_idx" ON "ChatRead"("userId");
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. UserPresence
CREATE TABLE "UserPresence" (
    "userId"     TEXT            NOT NULL,
    "status"     "PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. ChatSettings
CREATE TABLE "ChatSettings" (
    "id"                     TEXT         NOT NULL DEFAULT 'singleton',
    "maxFileSizeMb"          INTEGER      NOT NULL DEFAULT 10,
    "allowedExtensions"      TEXT[]       NOT NULL DEFAULT ARRAY['jpg','jpeg','png','gif','pdf','doc','docx','xls','xlsx','zip','mp4','mp3'],
    "messageEditWindowSec"   INTEGER      NOT NULL DEFAULT 300,
    "messageDeleteWindowSec" INTEGER      NOT NULL DEFAULT 300,
    "retentionDays"          INTEGER      NOT NULL DEFAULT 0,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById"            TEXT,
    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("id")
);
