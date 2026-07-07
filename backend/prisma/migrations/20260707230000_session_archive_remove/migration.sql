-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'REMOVED';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "removed_at" TIMESTAMP(3),
ADD COLUMN "removed_by_agent_id" TEXT;

-- CreateTable
CREATE TABLE "conversation_agent_archives" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_agent_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_agent_archives_tenant_id_idx" ON "conversation_agent_archives"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_agent_archives_agent_id_conversation_id_key" ON "conversation_agent_archives"("agent_id", "conversation_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_removed_by_agent_id_fkey" FOREIGN KEY ("removed_by_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agent_archives" ADD CONSTRAINT "conversation_agent_archives_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agent_archives" ADD CONSTRAINT "conversation_agent_archives_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agent_archives" ADD CONSTRAINT "conversation_agent_archives_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
