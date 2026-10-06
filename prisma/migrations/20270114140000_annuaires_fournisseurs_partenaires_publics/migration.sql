-- ANNUAIRES (Direction, 06/10) : « Fournisseurs Regulatory » devient un annuaire comme les autres (coordonnées), et
-- « Partenaires publics » s'ajoute — la même fiche que les partenaires, distinguée par sa sphère. Additive, idempotente :
-- les contacts existants restent des partenaires (PRIVE).

ALTER TABLE "CompanyContact" ADD COLUMN IF NOT EXISTS "sphere" TEXT NOT NULL DEFAULT 'PRIVE';
CREATE INDEX IF NOT EXISTS "CompanyContact_sphere_idx" ON "CompanyContact"("sphere");

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "city" TEXT;