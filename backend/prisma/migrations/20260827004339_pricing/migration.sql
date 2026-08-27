-- CreateTable
CREATE TABLE "model_prices" (
    "id" UUID NOT NULL,
    "vendor" "vendor" NOT NULL,
    "model_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cost_usd_micros" INTEGER NOT NULL,
    "dynamic_pricing" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_changes" (
    "id" UUID NOT NULL,
    "model_price_id" UUID NOT NULL,
    "previous_usd_micros" INTEGER NOT NULL,
    "new_usd_micros" INTEGER NOT NULL,
    "breached_floor" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_prices_category_idx" ON "model_prices"("category");

-- CreateIndex
CREATE UNIQUE INDEX "model_prices_vendor_model_id_key" ON "model_prices"("vendor", "model_id");

-- CreateIndex
CREATE INDEX "price_changes_detected_at_idx" ON "price_changes"("detected_at");

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_model_price_id_fkey" FOREIGN KEY ("model_price_id") REFERENCES "model_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
