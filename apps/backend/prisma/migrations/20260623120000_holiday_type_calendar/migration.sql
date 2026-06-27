-- Add a third holiday classification: تقویمی (calendar).
ALTER TYPE "HolidayType" ADD VALUE IF NOT EXISTS 'CALENDAR';
