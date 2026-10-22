-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;
