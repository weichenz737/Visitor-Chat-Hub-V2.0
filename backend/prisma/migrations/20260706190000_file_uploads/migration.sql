-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "uploader_type" "MessageSenderType" NOT NULL,
    "uploader_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_uploads_tenant_id_idx" ON "file_uploads"("tenant_id");

-- CreateIndex
CREATE INDEX "file_uploads_tenant_id_created_at_idx" ON "file_uploads"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from existing file messages
INSERT INTO "file_uploads" (
    "id", "tenant_id", "uploader_type", "uploader_id", "file_name", "file_size",
    "mime_type", "storage_path", "url", "message_id", "created_at"
)
SELECT
    gen_random_uuid()::text,
    m."tenant_id",
    m."sender_type",
    m."sender_id",
    COALESCE(m."file_name", 'unknown'),
    COALESCE(m."file_size", 0),
    CASE
        WHEN m."type" = 'IMAGE' THEN 'image/*'
        WHEN m."type" = 'VIDEO' THEN 'video/*'
        ELSE 'application/octet-stream'
    END,
    regexp_replace(m."content", '^https?://[^/]+/uploads/', ''),
    m."content",
    m."id",
    m."created_at"
FROM "messages" m
WHERE m."type" IN ('IMAGE', 'VIDEO', 'FILE')
  AND m."content" LIKE '%/uploads/%';
