-- COMPLÉMENTS (Direction, 10/2026 — « comble tous les manques ») :
--   1. STOCKS — le stock d'une DIRECTION RÉGIONALE de la PCH : `StockSnapshot.drCode` (scope ANNEX, annexId nul).
--      Les stocks d'Adventum viennent de la PCH (central + DR) et des hôpitaux (relevés des KAM) : pas de stock propre.
--   2. INFORMATION MÉDICALE — le produit d'une déclaration : `MedicalInfoDeclaration.productId` (nul = non précisé),
--      rattrapé ici pour les déclarations de matériel promotionnel (le reste se rattrape à l'ouverture de la liste).
--   3. MATÉRIEL PROMOTIONNEL — la date de besoin du demandeur : `PromoMaterial.neededBy`.
--
-- Idempotente : rejouée, elle ne change plus rien.

-- 1. STOCKS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "StockSnapshot" ADD COLUMN IF NOT EXISTS "drCode" TEXT;
CREATE INDEX IF NOT EXISTS "StockSnapshot_scope_drCode_date_idx" ON "StockSnapshot" ("scope", "drCode", "date");

-- 2. INFORMATION MÉDICALE ────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "productId" TEXT;
CREATE INDEX IF NOT EXISTS "MedicalInfoDeclaration_productId_idx" ON "MedicalInfoDeclaration" ("productId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalInfoDeclaration_productId_fkey') THEN
    ALTER TABLE "MedicalInfoDeclaration"
      ADD CONSTRAINT "MedicalInfoDeclaration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Le rattrapage du matériel promotionnel : le premier produit canonique des articles demandés (jamais un produit déjà posé).
UPDATE "MedicalInfoDeclaration" d
SET "productId" = sub."pid"
FROM (
  SELECT DISTINCT ON (i."promoMaterialId") i."promoMaterialId" AS "pm", rp."productId" AS "pid"
  FROM "PromoRequestItem" i
  JOIN "PromoRequestItemProduct" rp ON rp."itemId" = i."id"
  ORDER BY i."promoMaterialId", i."position", rp."productId"
) sub
WHERE d."productId" IS NULL
  AND d."sourceType"::text = 'PROMO_MATERIAL'
  AND d."sourceId" = sub."pm";

-- 3. MATÉRIEL PROMOTIONNEL ───────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "neededBy" TIMESTAMP(3);
