-- AlterTable
ALTER TABLE "messages" ADD COLUMN "file_name" TEXT;
ALTER TABLE "messages" ADD COLUMN "file_size" INTEGER;

-- Backfill legacy file names from metadata
UPDATE "messages"
SET "file_name" = COALESCE(
  metadata->>'file_name',
  metadata->>'filename'
)
WHERE "type" = 'FILE'
  AND "file_name" IS NULL
  AND metadata IS NOT NULL;

UPDATE "messages"
SET "file_size" = NULLIF(metadata->>'file_size', '')::INTEGER
WHERE "type" = 'FILE'
  AND "file_size" IS NULL
  AND metadata IS NOT NULL
  AND metadata->>'file_size' ~ '^[0-9]+$';
