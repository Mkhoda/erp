-- Files attached to announcements: JSON array of { url, name, size, mimeType }.
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
