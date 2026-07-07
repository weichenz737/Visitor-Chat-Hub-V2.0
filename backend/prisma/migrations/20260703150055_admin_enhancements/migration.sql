/*
  Warnings:

  - Added the required column `admin_email` to the `tenants` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AgentAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'DISABLED';

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "account_status" "AgentAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "remark" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "admin_email" TEXT NOT NULL DEFAULT 'admin@unknown.com',
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "remark" TEXT;

UPDATE "tenants" t SET "admin_email" = COALESCE(
  (SELECT a.email FROM "agents" a WHERE a.tenant_id = t.id AND a.role = 'SUPERVISOR' LIMIT 1),
  (SELECT a.email FROM "agents" a WHERE a.tenant_id = t.id LIMIT 1),
  'admin@unknown.com'
);

ALTER TABLE "tenants" ALTER COLUMN "admin_email" DROP DEFAULT;

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");
