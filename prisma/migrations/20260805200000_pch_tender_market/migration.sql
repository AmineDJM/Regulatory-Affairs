-- APPEL D'OFFRES PCH : nature de l'unité demandée + paysage concurrentiel dénormalisé.
-- Un marché ne parle pas toujours de comprimés (flacon, seringue, ampoule…), et l'analyse
-- de marché doit rester lisible dans le tableau et dans l'export Excel sans recalcul.
-- Idempotent — sûr à rejouer.

ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "unitLabel"        TEXT;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "marketOrigin"     TEXT;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "marketVillePct"   DECIMAL(5,2);
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "marketHopitalPct" DECIMAL(5,2);
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "marketHhi"        INTEGER;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "competitorsTop"   TEXT;
