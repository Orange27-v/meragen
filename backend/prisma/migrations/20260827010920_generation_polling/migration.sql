-- AlterTable
ALTER TABLE "generations" ADD COLUMN     "last_polled_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "generations_status_last_polled_at_idx" ON "generations"("status", "last_polled_at");
