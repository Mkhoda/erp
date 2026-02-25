-- CreateTable: Page — registered dashboard pages with isActive flag
CREATE TABLE "Page" (
    "id"        TEXT NOT NULL,
    "path"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Page_path_key" ON "Page"("path");
