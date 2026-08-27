-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE PRODUIT CANONIQUE — additive, idempotente, non destructive.
--
-- Aucun modèle existant n'est supprimé ni modifié dans ses champs. `RegulatoryProduct`,
-- `PromoProduct` et `BdProduct` gagnent chacun un `productId` NULLABLE et deviennent des
-- PROFILS du produit canonique. Une base déjà migrée traverse ce fichier sans effet.
--
-- Pourquoi un modèle de plus alors que `RegulatoryProduct` est déjà riche : un produit doit
-- pouvoir exister AVANT son enregistrement (un `BdProduct` en TO_STUDY n'a pas de dossier).
-- Voir src/lib/products/identity.ts.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "Product" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "dci"           TEXT NOT NULL,
  "dosage"        TEXT,
  "dosageUnit"    TEXT,
  "form"          TEXT,
  "packaging"     TEXT,
  "identityKey"   TEXT NOT NULL,
  "channel"       "ProductChannel" NOT NULL DEFAULT 'BOTH',
  "companyId"     TEXT,
  "lifecycle"     TEXT NOT NULL DEFAULT 'STUDY',
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- L'UNICITÉ DE LA CLÉ D'IDENTITÉ est la garantie anti-doublon. Elle est portée par la BASE et
-- non par la vigilance de l'appelant : c'est ce qui empêche deux imports concurrents de créer
-- deux fois le même produit.
CREATE UNIQUE INDEX IF NOT EXISTS "Product_code_key"        ON "Product"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_identityKey_key" ON "Product"("identityKey");
CREATE INDEX IF NOT EXISTS "Product_dci_idx"                ON "Product"("dci");
CREATE INDEX IF NOT EXISTS "Product_companyId_idx"          ON "Product"("companyId");
CREATE INDEX IF NOT EXISTS "Product_lifecycle_idx"          ON "Product"("lifecycle");

CREATE TABLE IF NOT EXISTS "ProductAlias" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "source"      TEXT NOT NULL DEFAULT 'MANUAL',
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);
-- Deux produits ne peuvent pas revendiquer le même alias : la base refuse plutôt que de laisser
-- une ambiguïté s'installer et se découvrir six mois plus tard sur une mauvaise réponse.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAlias_key_key"      ON "ProductAlias"("key");
CREATE INDEX IF NOT EXISTS        "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- ─────────────────────────── Les profils ───────────────────────────

ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "PromoProduct"      ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "BdProduct"         ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "RegulatoryProduct_productId_idx" ON "RegulatoryProduct"("productId");
CREATE INDEX IF NOT EXISTS "PromoProduct_productId_idx"      ON "PromoProduct"("productId");
CREATE INDEX IF NOT EXISTS "BdProduct_productId_idx"         ON "BdProduct"("productId");

-- Les clés étrangères. `ON DELETE SET NULL` partout : supprimer un produit canonique ne doit
-- JAMAIS emporter un dossier réglementaire — le dossier est la pièce officielle, le produit
-- n'est qu'une clé de lecture.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_companyId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductAlias_productId_fkey') THEN
    ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductAlias_createdById_fkey') THEN
    ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RegulatoryProduct_productId_fkey') THEN
    ALTER TABLE "RegulatoryProduct" ADD CONSTRAINT "RegulatoryProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoProduct_productId_fkey') THEN
    ALTER TABLE "PromoProduct" ADD CONSTRAINT "PromoProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BdProduct_productId_fkey') THEN
    ALTER TABLE "BdProduct" ADD CONSTRAINT "BdProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
