-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- STOCK PROMOTIONNEL, ÉTAPE 4 — LE MATÉRIEL DU STOCK SUR LES DEMANDES AD & PRO (§118.167)
--
-- Un poste « Matériel du stock » liste des articles du MAGASIN CENTRAL. À l'accord du poste, la
-- quantité est RÉSERVÉE (elle quitte le magasin) ; après l'événement, on CONFIRME ce qui a été
-- remis, rendu, abîmé ou perdu, et le reste revient au magasin par la même écriture.
--
-- Idempotente : chaque ajout se vérifie avant de se faire. `ALTER TYPE … ADD VALUE IF NOT EXISTS`
-- est la seule forme sûre pour une énumération existante.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'STOCK_MATERIAL';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'RESERVATION_OUT';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'RESERVATION_BACK';

DO $$ BEGIN
  CREATE TYPE "AdProStockLineStatut" AS ENUM ('DEMANDEE', 'RESERVEE', 'CONFIRMEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AdProStockLine" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "quantite" DECIMAL(12,3) NOT NULL,
  "statut" "AdProStockLineStatut" NOT NULL DEFAULT 'DEMANDEE',
  "reserveeLe" TIMESTAMP(3),
  "reserveeParId" TEXT,
  "utilisee" DECIMAL(12,3),
  "rendue" DECIMAL(12,3),
  "abimee" DECIMAL(12,3),
  "perdue" DECIMAL(12,3),
  "confirmeeLe" TIMESTAMP(3),
  "confirmeeParId" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdProStockLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProStockLine_itemId_stockItemId_key" ON "AdProStockLine"("itemId", "stockItemId");
CREATE INDEX IF NOT EXISTS "AdProStockLine_stockItemId_idx" ON "AdProStockLine"("stockItemId");
CREATE INDEX IF NOT EXISTS "AdProStockLine_statut_idx" ON "AdProStockLine"("statut");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProStockLine_itemId_fkey') THEN
    ALTER TABLE "AdProStockLine" ADD CONSTRAINT "AdProStockLine_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProStockLine_stockItemId_fkey') THEN
    ALTER TABLE "AdProStockLine" ADD CONSTRAINT "AdProStockLine_stockItemId_fkey"
      FOREIGN KEY ("stockItemId") REFERENCES "PromoStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "adProLineId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoStockMovement_adProLineId_idx" ON "PromoStockMovement"("adProLineId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_adProLineId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_adProLineId_fkey"
      FOREIGN KEY ("adProLineId") REFERENCES "AdProStockLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
