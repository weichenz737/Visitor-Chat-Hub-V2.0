ALTER TABLE "tenants" ADD COLUMN "tenant_code" TEXT;

UPDATE "tenants" SET "tenant_code" = CASE WHEN "slug" = 'demo' THEN 'demo001' ELSE "slug" END;

ALTER TABLE "tenants" ALTER COLUMN "tenant_code" SET NOT NULL;

CREATE UNIQUE INDEX "tenants_tenant_code_key" ON "tenants"("tenant_code");
