-- CreateTable
CREATE TABLE "RateSet" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 17,
    "items" JSONB NOT NULL,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "RateSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateSet_city_category_status_idx" ON "RateSet"("city", "category", "status");
