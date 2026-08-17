-- FUSION DES CATALOGUES PRODUITS — par rattachement, pas par écrasement.
--
-- Trois modules tenaient leur propre liste : le réglementaire (les dossiers, la référence), le
-- business development (produits à l'étude) et le planning promotionnel. Chacun écrivait la même
-- molécule à sa façon, et rien ne disait qu'il s'agissait du même produit.
--
-- On AJOUTE un lien facultatif vers le dossier réglementaire. On n'écrase RIEN : les libellés
-- saisis restent, et aucun rattachement n'est deviné — un rapprochement automatique sur
-- ressemblance confondrait un jour un 500 mg et un 1 g, qui sont deux produits, deux AMM, deux prix.
-- Idempotent : rejouable sur une instance déjà migrée.

ALTER TABLE "BdProduct"    ADD COLUMN IF NOT EXISTS "regulatoryProductId" TEXT;
ALTER TABLE "PromoProduct" ADD COLUMN IF NOT EXISTS "regulatoryProductId" TEXT;

CREATE INDEX IF NOT EXISTS "BdProduct_regulatoryProductId_idx"    ON "BdProduct"("regulatoryProductId");
CREATE INDEX IF NOT EXISTS "PromoProduct_regulatoryProductId_idx" ON "PromoProduct"("regulatoryProductId");

DO $$ BEGIN
  ALTER TABLE "BdProduct" ADD CONSTRAINT "BdProduct_regulatoryProductId_fkey"
    FOREIGN KEY ("regulatoryProductId") REFERENCES "RegulatoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoProduct" ADD CONSTRAINT "PromoProduct_regulatoryProductId_fkey"
    FOREIGN KEY ("regulatoryProductId") REFERENCES "RegulatoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
