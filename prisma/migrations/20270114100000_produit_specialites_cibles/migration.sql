-- PRODUIT × BU → SPÉCIALITÉS VISÉES (cahier des charges §6, §73) : un produit d'une BU multi-spécialités n'en vise
-- qu'une partie. Additive et idempotente ; aucune ligne écrite (vide = le produit vise toutes celles de sa BU).

CREATE TABLE IF NOT EXISTS "PromoProductSpecialite" (
  "id" TEXT NOT NULL,
  "promoProductId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoProductSpecialite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoProductSpecialite_promoProductId_specialtyId_key" ON "PromoProductSpecialite"("promoProductId", "specialtyId");
CREATE INDEX IF NOT EXISTS "PromoProductSpecialite_specialtyId_idx" ON "PromoProductSpecialite"("specialtyId");

DO $$ BEGIN
  ALTER TABLE "PromoProductSpecialite" ADD CONSTRAINT "PromoProductSpecialite_promoProductId_fkey" FOREIGN KEY ("promoProductId") REFERENCES "PromoProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PromoProductSpecialite" ADD CONSTRAINT "PromoProductSpecialite_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "MedicalSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
