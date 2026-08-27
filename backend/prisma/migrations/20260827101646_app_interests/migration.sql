-- CreateTable
CREATE TABLE "app_interests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "app_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_interests_app_name_idx" ON "app_interests"("app_name");

-- CreateIndex
CREATE UNIQUE INDEX "app_interests_user_id_app_name_key" ON "app_interests"("user_id", "app_name");

-- AddForeignKey
ALTER TABLE "app_interests" ADD CONSTRAINT "app_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

