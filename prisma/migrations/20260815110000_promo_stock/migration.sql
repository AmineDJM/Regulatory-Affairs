-- STOCK DE MATÉRIEL PROMOTIONNEL. La quantité n'est jamais stockée : elle se calcule à partir
-- des mouvements, seuls écrits. Idempotent : rejouable sans effet de bord.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromoMovementKind') THEN
    CREATE TYPE "PromoMovementKind" AS ENUM ('RECEIPT', 'DISTRIBUTION', 'LOSS', 'CORRECTION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PromoStockItem" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT,
  "name"            TEXT NOT NULL,
  "materialType"    "MaterialType",
  "reference"       TEXT,
  "unit"            TEXT,
  "location"        TEXT,
  "alertThreshold"  DECIMAL(12,3),
  "notes"           TEXT,
  "promoMaterialId" TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdById"     TEXT,
  "updatedById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PromoStockMovement" (
  "id"          TEXT PRIMARY KEY,
  "itemId"      TEXT NOT NULL,
  "kind"        "PromoMovementKind" NOT NULL,
  "delta"       DECIMAL(12,3) NOT NULL,
  "recipient"   TEXT,
  "reason"      TEXT,
  "occurredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PromoStockItem_companyId_idx"       ON "PromoStockItem" ("companyId");
CREATE INDEX IF NOT EXISTS "PromoStockItem_isActive_idx"        ON "PromoStockItem" ("isActive");
CREATE INDEX IF NOT EXISTS "PromoStockItem_promoMaterialId_idx" ON "PromoStockItem" ("promoMaterialId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_itemId_occurredAt_idx" ON "PromoStockMovement" ("itemId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockItem_companyId_fkey') THEN
    ALTER TABLE "PromoStockItem" ADD CONSTRAINT "PromoStockItem_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Supprimer un article emporte SES mouvements : un mouvement orphelin ne compte plus rien
  -- et resterait à jamais dans une table que personne ne relit.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_itemId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
