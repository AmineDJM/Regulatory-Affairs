-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LES RELATIONS DU PRODUIT CANONIQUE — additive, idempotente, non destructive.
--
-- Le lot précédent a créé `Product` et l'a branché aux trois PROFILS (Regulatory, Promo, Bd).
-- Un produit qui n'est relié qu'à ses profils ne répond encore à aucune question métier :
-- « combien rapporte-t-il », « qui le porte », « combien coûte sa promotion » traversent des
-- ventes, des affectations, des lignes d'AO et des dépenses Ad&Pro.
--
-- Ce fichier ajoute ces traversées. AUCUNE colonne existante n'est supprimée ni modifiée :
-- `PchTenderLine.ourProductId` (identifiant orphelin, sans relation), `Sale.product` (texte),
-- `Sale.isPch` et `MedicalVisit.presentedProducts` (texte) sont tous CONSERVÉS. Ils portent
-- l'historique et les écrans les lisent.
--
-- Toutes les nouvelles clés vers `Product` sont NULLABLES : une vente de service n'a pas de
-- produit canonique, et un AO nomme des produits que nous ne portons pas.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────── Qui porte quel produit, et depuis quand ───────────────────────

CREATE TABLE IF NOT EXISTS "ProductAssignment" (
  "id"            TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "role"          TEXT NOT NULL DEFAULT 'DELEGATE',
  "territory"     TEXT,
  "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"       TIMESTAMP(3),
  "allocationPct" DECIMAL(5,2),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAssignment_pkey" PRIMARY KEY ("id")
);

-- La DATE fait partie de l'unicité : réaffecter la même personne au même produit plus tard est
-- une nouvelle affectation, pas un doublon. Sans elle, on ne pourrait pas réattribuer un produit
-- à quelqu'un qui l'avait déjà porté.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAssignment_productId_userId_role_startedAt_key"
  ON "ProductAssignment"("productId", "userId", "role", "startedAt");
CREATE INDEX IF NOT EXISTS "ProductAssignment_userId_idx"    ON "ProductAssignment"("userId");
CREATE INDEX IF NOT EXISTS "ProductAssignment_productId_idx" ON "ProductAssignment"("productId");

-- ─────────────────────── Les produits présentés en visite ───────────────────────

CREATE TABLE IF NOT EXISTS "MedicalVisitProduct" (
  "id"        TEXT NOT NULL,
  "visitId"   TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "MedicalVisitProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MedicalVisitProduct_visitId_productId_key"
  ON "MedicalVisitProduct"("visitId", "productId");
CREATE INDEX IF NOT EXISTS "MedicalVisitProduct_productId_idx" ON "MedicalVisitProduct"("productId");

-- ─────────────────────── La part d'une dépense Ad&Pro imputable à un produit ───────────────────────

CREATE TABLE IF NOT EXISTS "AdProProductAllocation" (
  "id"              TEXT NOT NULL,
  "itemId"          TEXT NOT NULL,
  "productId"       TEXT NOT NULL,
  "sharePct"        DECIMAL(5,2),
  "amountAllocated" DECIMAL(14,2),
  "tenderLineId"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProProductAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProProductAllocation_itemId_productId_key"
  ON "AdProProductAllocation"("itemId", "productId");
CREATE INDEX IF NOT EXISTS "AdProProductAllocation_productId_idx" ON "AdProProductAllocation"("productId");

-- ─────────────────────── Les colonnes ajoutées aux modèles existants ───────────────────────

-- La ligne d'AO et le produit que nous portons en face. `ourProductId` reste en place : il
-- pointe sur `RegulatoryProduct` et des écrans le lisent encore.
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "productId" TEXT;

-- La vente et ce qu'elle a réellement vendu. `product` (texte) et `isPch` (booléen) restent :
-- le premier est la désignation libre, le second dit qu'une vente vient de la PCH — sans jamais
-- dire de QUEL marché, ce que `tenderLineId` corrige.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "productId"    TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "tenderLineId" TEXT;

CREATE INDEX IF NOT EXISTS "PchTenderLine_productId_idx" ON "PchTenderLine"("productId");
CREATE INDEX IF NOT EXISTS "Sale_productId_idx"          ON "Sale"("productId");
CREATE INDEX IF NOT EXISTS "Sale_tenderLineId_idx"       ON "Sale"("tenderLineId");

-- ─────────────────────── Les clés étrangères ───────────────────────
--
-- DEUX RÈGLES DE SUPPRESSION, et la différence compte :
--
--   • ON DELETE CASCADE sur les tables de LIAISON (affectation, visite↔produit, imputation).
--     Une ligne de liaison n'a aucun sens sans ses deux bouts : la garder orpheline serait
--     conserver une imputation vers un produit qui n'existe plus.
--
--   • ON DELETE SET NULL sur les colonnes ajoutées à des enregistrements MÉTIER (vente, ligne
--     d'AO). Une vente est une pièce comptable : supprimer un produit canonique ne doit JAMAIS
--     effacer une vente. Elle perd sa clé de lecture, elle garde sa valeur.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductAssignment_productId_fkey') THEN
    ALTER TABLE "ProductAssignment" ADD CONSTRAINT "ProductAssignment_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductAssignment_userId_fkey') THEN
    ALTER TABLE "ProductAssignment" ADD CONSTRAINT "ProductAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitProduct_visitId_fkey') THEN
    ALTER TABLE "MedicalVisitProduct" ADD CONSTRAINT "MedicalVisitProduct_visitId_fkey"
      FOREIGN KEY ("visitId") REFERENCES "MedicalVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitProduct_productId_fkey') THEN
    ALTER TABLE "MedicalVisitProduct" ADD CONSTRAINT "MedicalVisitProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProProductAllocation_itemId_fkey') THEN
    ALTER TABLE "AdProProductAllocation" ADD CONSTRAINT "AdProProductAllocation_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProProductAllocation_productId_fkey') THEN
    ALTER TABLE "AdProProductAllocation" ADD CONSTRAINT "AdProProductAllocation_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProProductAllocation_tenderLineId_fkey') THEN
    ALTER TABLE "AdProProductAllocation" ADD CONSTRAINT "AdProProductAllocation_tenderLineId_fkey"
      FOREIGN KEY ("tenderLineId") REFERENCES "PchTenderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchTenderLine_productId_fkey') THEN
    ALTER TABLE "PchTenderLine" ADD CONSTRAINT "PchTenderLine_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_productId_fkey') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_tenderLineId_fkey') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenderLineId_fkey"
      FOREIGN KEY ("tenderLineId") REFERENCES "PchTenderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
