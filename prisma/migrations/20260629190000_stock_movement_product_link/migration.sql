-- Un mouvement de stock PCH peut être rattaché à un produit Regulatory (catalogue produits).
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
