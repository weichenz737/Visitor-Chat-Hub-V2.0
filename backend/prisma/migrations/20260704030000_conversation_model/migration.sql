-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Add conversation_id to sessions (nullable first)
ALTER TABLE "sessions" ADD COLUMN "conversation_id" TEXT;

-- Backfill: one conversation per (tenant_id, user_id)
INSERT INTO "conversations" ("id", "tenant_id", "user_id", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    s.tenant_id,
    s.user_id,
    MIN(s.created_at),
    MAX(s.updated_at)
FROM "sessions" s
GROUP BY s.tenant_id, s.user_id;

UPDATE "sessions" s
SET "conversation_id" = c.id
FROM "conversations" c
WHERE c.tenant_id = s.tenant_id AND c.user_id = s.user_id;

-- Make required
ALTER TABLE "sessions" ALTER COLUMN "conversation_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_user_id_key" ON "conversations"("tenant_id", "user_id");
CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");
CREATE INDEX "sessions_tenant_id_conversation_id_idx" ON "sessions"("tenant_id", "conversation_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
