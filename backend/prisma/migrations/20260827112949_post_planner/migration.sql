-- CreateEnum
CREATE TYPE "scheduled_post_status" AS ENUM ('planned', 'generating', 'ready', 'published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "post_platform" AS ENUM ('manual', 'instagram', 'facebook');

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "scheduled_post_status" NOT NULL DEFAULT 'planned',
    "platform" "post_platform" NOT NULL DEFAULT 'manual',
    "tier_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "caption" TEXT,
    "generation_id" UUID,
    "error_message" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "renews_at" TIMESTAMP(3) NOT NULL,
    "last_charged_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_posts_generation_id_key" ON "scheduled_posts"("generation_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_user_id_scheduled_for_idx" ON "scheduled_posts"("user_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_scheduled_for_idx" ON "scheduled_posts"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_active_renews_at_idx" ON "subscriptions"("active", "renews_at");

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

