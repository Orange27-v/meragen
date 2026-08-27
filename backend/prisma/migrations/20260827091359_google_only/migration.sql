-- AlterTable
ALTER TABLE "users" DROP COLUMN "password_hash",
ALTER COLUMN "auth_provider" SET DEFAULT 'google';

