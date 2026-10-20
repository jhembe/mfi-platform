-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;

-- CreateTable
CREATE TABLE "portal_phone_index" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_phone_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_phone_index_phone_idx" ON "portal_phone_index"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "portal_phone_index_phone_tenant_id_key" ON "portal_phone_index"("phone", "tenant_id");

-- AddForeignKey
ALTER TABLE "portal_phone_index" ADD CONSTRAINT "portal_phone_index_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
