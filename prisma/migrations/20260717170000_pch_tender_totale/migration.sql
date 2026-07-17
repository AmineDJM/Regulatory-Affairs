-- PCH « totale » : prix de référence verrouillé (Réception 2025), enregistrement de notre produit,
-- et rattachement d'un bon de commande (vente réelle) à une ligne gagnée. Idempotent.

ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "refPriceDzd"    DECIMAL(14,2);
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "refPriceSource" TEXT;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "registeredOurs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PchOrder"      ADD COLUMN IF NOT EXISTS "lineId"         TEXT;

CREATE INDEX IF NOT EXISTS "PchOrder_lineId_idx" ON "PchOrder"("lineId");
