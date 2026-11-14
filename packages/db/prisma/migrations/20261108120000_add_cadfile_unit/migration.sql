-- AlterTable
-- Both columns are nullable and have no default: existing rows are untouched
-- (no backfill). A null "unit" means "legacy, units never verified".
ALTER TABLE "CadFile" ADD COLUMN     "dxfBlobKey" TEXT,
ADD COLUMN     "unit" JSONB;
