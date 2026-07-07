-- AlterEnum
ALTER TYPE "AgentOnlineStatus" ADD VALUE IF NOT EXISTS 'AWAY';

-- Agent: agent code & avatar
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_code" TEXT;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "agents_tenant_id_agent_code_key" ON "agents"("tenant_id", "agent_code");

-- User: visitor numbering & visit tracking
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "visitor_no" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "original_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_seen_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_visitor_no_key" ON "users"("tenant_id", "visitor_no");

-- Session: preferred agent from share link
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "preferred_agent_id" TEXT;

-- Remark: one remark per agent per user
CREATE UNIQUE INDEX IF NOT EXISTS "remarks_tenant_id_user_id_agent_id_key" ON "remarks"("tenant_id", "user_id", "agent_id");
