-- AlterTable
ALTER TABLE "brand_assets" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "storage_key" TEXT,
ADD COLUMN     "used_count" INTEGER NOT NULL DEFAULT 0;

