-- Make email optional so users can be created with phone-only auth
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
