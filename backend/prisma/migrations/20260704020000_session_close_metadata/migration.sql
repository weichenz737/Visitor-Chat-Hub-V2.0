-- CreateEnum
CREATE TYPE "SessionClosedBy" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SessionCloseReason" AS ENUM ('MANUAL', 'TIMEOUT', 'DISCONNECT');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "closed_by" "SessionClosedBy";
ALTER TABLE "sessions" ADD COLUMN "closed_reason" "SessionCloseReason";
