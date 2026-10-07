-- PRODUITS 360 : LES PRIX SAISIS A LA MAIN (Direction, 07/10).
--
-- L'Explorateur produits donne le prix observe (IQVIA ville, receptions PCH) ; une saisie manuelle l'emporte a partir
-- de sa date d'effet. Une ligne par saisie (historique), montant NUL = retour a la valeur de l'Explorateur.
-- Idempotente : table, index et cle etrangere ne sont crees que s'ils n'existent pas.

CREATE TABLE IF NOT EXISTS "ProductPrice" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amountDzd" DECIMAL(14,2),
  "validFrom" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "setById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPrice_productId_kind_validFrom_idx" ON "ProductPrice"("productId", "kind", "validFrom");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductPrice_productId_fkey') THEN
    ALTER TABLE "ProductPrice"
      ADD CONSTRAINT "ProductPrice_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
