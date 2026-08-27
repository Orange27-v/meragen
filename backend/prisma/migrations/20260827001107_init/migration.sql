-- CreateEnum
CREATE TYPE "credit_transaction_type" AS ENUM ('topup', 'generation_charge', 'refund');

-- CreateEnum
CREATE TYPE "generation_status" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "vendor" AS ENUM ('muapi', 'ninejalingo');

-- CreateEnum
CREATE TYPE "brand_asset_type" AS ENUM ('character', 'voice_profile', 'template');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "credit_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "paystack_ref" TEXT,
    "idempotency_key" TEXT,
    "generation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "vendor" "vendor" NOT NULL,
    "model_id" TEXT NOT NULL,
    "status" "generation_status" NOT NULL DEFAULT 'queued',
    "input_params" JSONB NOT NULL,
    "cost_credits" INTEGER NOT NULL,
    "vendor_cost_usd_cents" INTEGER,
    "vendor_job_id" TEXT,
    "output_url" TEXT,
    "error_message" TEXT,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "brand_asset_type" NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_reference" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_paystack_ref_key" ON "credit_transactions"("paystack_ref");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_idempotency_key_key" ON "credit_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "generations_user_id_created_at_idx" ON "generations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "generations_status_idx" ON "generations"("status");

-- CreateIndex
CREATE INDEX "generations_vendor_job_id_idx" ON "generations"("vendor_job_id");

-- CreateIndex
CREATE INDEX "brand_assets_user_id_type_idx" ON "brand_assets"("user_id", "type");

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
