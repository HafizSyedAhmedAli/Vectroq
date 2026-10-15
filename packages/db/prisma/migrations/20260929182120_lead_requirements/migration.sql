-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "additionalNotes" TEXT,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "budgetRange" TEXT,
ADD COLUMN     "consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coveredAreaSqFt" DOUBLE PRECISION,
ADD COLUMN     "floors" INTEGER,
ADD COLUMN     "houseType" TEXT NOT NULL DEFAULT 'House',
ADD COLUMN     "planFileName" TEXT,
ADD COLUMN     "planFileUrl" TEXT,
ADD COLUMN     "plotSizeSqYd" DOUBLE PRECISION,
ADD COLUMN     "timeline" TEXT;
