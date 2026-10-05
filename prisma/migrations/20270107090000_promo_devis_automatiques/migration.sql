-- §118.204 — matériel promotionnel : précisions de la demande de devis, et ce que chaque ligne promeut.
-- Idempotente : rejouée, elle ne change rien. Aucune donnée existante n'est réécrite.
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "precisionsDevis" TEXT;
ALTER TABLE "PromoRequestItem" ADD COLUMN IF NOT EXISTS "promus" JSONB;
