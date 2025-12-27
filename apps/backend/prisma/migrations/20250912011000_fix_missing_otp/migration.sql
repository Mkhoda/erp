-- Fix missing Otp table and index if migration didn't apply fully
CREATE TABLE IF NOT EXISTS "public"."Otp" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- Ensure index exists
CREATE INDEX IF NOT EXISTS "Otp_phone_createdAt_idx" ON "public"."Otp"("phone", "createdAt");