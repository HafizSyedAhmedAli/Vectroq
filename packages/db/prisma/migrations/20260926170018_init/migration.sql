-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "model" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
