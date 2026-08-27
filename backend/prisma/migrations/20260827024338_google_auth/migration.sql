-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('password', 'google');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_provider" "auth_provider" NOT NULL DEFAULT 'password',
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firebase_uid" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

