-- Canal de distribution produit : Ville (RETAIL) / Hôpital (HOSPITAL) / les deux (BOTH).
-- Ajouté à PromoProduct (promotion médicale) et RegulatoryProduct (registre réglementaire). Idempotent.

DO $$ BEGIN
  CREATE TYPE "ProductChannel" AS ENUM ('RETAIL', 'HOSPITAL', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "PromoProduct"      ADD COLUMN IF NOT EXISTS "channel" "ProductChannel" NOT NULL DEFAULT 'BOTH';
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "channel" "ProductChannel" NOT NULL DEFAULT 'BOTH';
