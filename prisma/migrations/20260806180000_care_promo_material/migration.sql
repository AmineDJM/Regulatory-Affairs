-- Une personne prise en charge peut nécessiter du matériel promotionnel (brochure, kit,
-- présentoir). Comme ailleurs, on ne recopie pas son circuit : la case POINTE vers un
-- PromoMaterial qui suit son propre parcours (visa publicitaire, conformité, agence, BAT).
ALTER TYPE "CareServiceKind" ADD VALUE IF NOT EXISTS 'PROMO_MATERIAL';
ALTER TABLE "CareCell" ADD COLUMN IF NOT EXISTS "promoMaterialId" TEXT;
CREATE INDEX IF NOT EXISTS "CareCell_promoMaterialId_idx" ON "CareCell"("promoMaterialId");
