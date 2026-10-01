-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- STOCK PROMOTIONNEL, ÉTAPE 2 — LES ACHATS ENTRENT AU STOCK (§118.165)
--
-- La demande se compose d'ARTICLES piochés dans le catalogue (produits, quantité, actions,
-- commentaire) ; chaque ligne de devis porte l'ACTION qu'elle chiffre et l'article demandé auquel
-- elle se rapproche ; la facture d'un BC se détaille LIGNE À LIGNE, et chaque ligne reçue entre au
-- magasin central en un lot au coût de la facture.
--
-- RIEN N'EST REMPLI À LA PLACE DE PERSONNE. Les dossiers en vol n'ont pas d'articles demandés, et
-- c'est juste : leurs devis sont déjà chiffrés. Leurs lignes de devis gardent `action` et
-- `requestItemId` nuls (« ligne d'avant ce rapprochement »), et leurs factures déjà déposées
-- n'ont pas de détail : elles gardent le comportement d'avant (le paiement ne les attend pas à la
-- réception). Idempotente de bout en bout : un second passage ne crée rien.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Le vocabulaire des actions ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PromoAction" AS ENUM ('CONCEPTION', 'IMPRESSION', 'FABRICATION', 'ACHAT', 'LOCATION', 'LIVRAISON', 'INSTALLATION', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Les articles demandés ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoRequestItem" (
  "id"              TEXT NOT NULL,
  "promoMaterialId" TEXT NOT NULL,
  "position"        INTEGER NOT NULL DEFAULT 0,
  "catalogueId"     TEXT NOT NULL,
  "quantite"        DECIMAL(12,3),
  "actions"         "PromoAction"[] DEFAULT ARRAY[]::"PromoAction"[],
  "commentaire"     TEXT,
  "createdById"     TEXT,
  "updatedById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoRequestItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoRequestItem_promoMaterialId_idx" ON "PromoRequestItem"("promoMaterialId");
CREATE INDEX IF NOT EXISTS "PromoRequestItem_catalogueId_idx" ON "PromoRequestItem"("catalogueId");

CREATE TABLE IF NOT EXISTS "PromoRequestItemProduct" (
  "itemId"    TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "PromoRequestItemProduct_pkey" PRIMARY KEY ("itemId", "productId")
);
CREATE INDEX IF NOT EXISTS "PromoRequestItemProduct_productId_idx" ON "PromoRequestItemProduct"("productId");

-- ─── 3. Les lignes de devis : l'action chiffrée, l'article demandé ───────────────────────
ALTER TABLE "PromoQuoteLine" ADD COLUMN IF NOT EXISTS "action" "PromoAction";
ALTER TABLE "PromoQuoteLine" ADD COLUMN IF NOT EXISTS "requestItemId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoQuoteLine_requestItemId_idx" ON "PromoQuoteLine"("requestItemId");

-- ─── 4. La facture détaillée et ses lignes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoFacture" (
  "id"              TEXT NOT NULL,
  "legalDocumentId" TEXT NOT NULL,
  "quoteId"         TEXT,
  "tvaRate"         DECIMAL(5,2) NOT NULL,
  "extraTaxLabel"   TEXT,
  "extraTaxRate"    DECIMAL(5,2),
  "totalImprime"    DECIMAL(14,2),
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoFacture_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoFacture_legalDocumentId_key" ON "PromoFacture"("legalDocumentId");
CREATE INDEX IF NOT EXISTS "PromoFacture_quoteId_idx" ON "PromoFacture"("quoteId");

CREATE TABLE IF NOT EXISTS "PromoFactureLigne" (
  "id"            TEXT NOT NULL,
  "factureId"     TEXT NOT NULL,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "designation"   TEXT NOT NULL,
  "action"        "PromoAction",
  "unite"         TEXT,
  "quantite"      DECIMAL(14,3) NOT NULL,
  "prixUnitaire"  DECIMAL(14,2) NOT NULL,
  "quoteLineId"   TEXT,
  "requestItemId" TEXT,
  "quantiteRecue" DECIMAL(14,3),
  "recueLe"       TIMESTAMP(3),
  "recueParId"    TEXT,
  "renonce"       BOOLEAN NOT NULL DEFAULT false,
  "renonceMotif"  TEXT,
  "renonceLe"     TIMESTAMP(3),
  "renonceParId"  TEXT,
  "stockItemId"   TEXT,
  "stockLotId"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoFactureLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoFactureLigne_factureId_idx" ON "PromoFactureLigne"("factureId");
CREATE INDEX IF NOT EXISTS "PromoFactureLigne_quoteLineId_idx" ON "PromoFactureLigne"("quoteLineId");
CREATE INDEX IF NOT EXISTS "PromoFactureLigne_requestItemId_idx" ON "PromoFactureLigne"("requestItemId");
CREATE INDEX IF NOT EXISTS "PromoFactureLigne_stockLotId_idx" ON "PromoFactureLigne"("stockLotId");

-- ─── 5. Les clés étrangères ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoRequestItem_promoMaterialId_fkey') THEN
    ALTER TABLE "PromoRequestItem" ADD CONSTRAINT "PromoRequestItem_promoMaterialId_fkey"
      FOREIGN KEY ("promoMaterialId") REFERENCES "PromoMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoRequestItem_catalogueId_fkey') THEN
    ALTER TABLE "PromoRequestItem" ADD CONSTRAINT "PromoRequestItem_catalogueId_fkey"
      FOREIGN KEY ("catalogueId") REFERENCES "PromoCatalogueArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoRequestItemProduct_itemId_fkey') THEN
    ALTER TABLE "PromoRequestItemProduct" ADD CONSTRAINT "PromoRequestItemProduct_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoRequestItemProduct_productId_fkey') THEN
    ALTER TABLE "PromoRequestItemProduct" ADD CONSTRAINT "PromoRequestItemProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoQuoteLine_requestItemId_fkey') THEN
    ALTER TABLE "PromoQuoteLine" ADD CONSTRAINT "PromoQuoteLine_requestItemId_fkey"
      FOREIGN KEY ("requestItemId") REFERENCES "PromoRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFacture_legalDocumentId_fkey') THEN
    ALTER TABLE "PromoFacture" ADD CONSTRAINT "PromoFacture_legalDocumentId_fkey"
      FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFacture_quoteId_fkey') THEN
    ALTER TABLE "PromoFacture" ADD CONSTRAINT "PromoFacture_quoteId_fkey"
      FOREIGN KEY ("quoteId") REFERENCES "PromoQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFactureLigne_factureId_fkey') THEN
    ALTER TABLE "PromoFactureLigne" ADD CONSTRAINT "PromoFactureLigne_factureId_fkey"
      FOREIGN KEY ("factureId") REFERENCES "PromoFacture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFactureLigne_quoteLineId_fkey') THEN
    ALTER TABLE "PromoFactureLigne" ADD CONSTRAINT "PromoFactureLigne_quoteLineId_fkey"
      FOREIGN KEY ("quoteLineId") REFERENCES "PromoQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFactureLigne_requestItemId_fkey') THEN
    ALTER TABLE "PromoFactureLigne" ADD CONSTRAINT "PromoFactureLigne_requestItemId_fkey"
      FOREIGN KEY ("requestItemId") REFERENCES "PromoRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFactureLigne_stockItemId_fkey') THEN
    ALTER TABLE "PromoFactureLigne" ADD CONSTRAINT "PromoFactureLigne_stockItemId_fkey"
      FOREIGN KEY ("stockItemId") REFERENCES "PromoStockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoFactureLigne_stockLotId_fkey') THEN
    ALTER TABLE "PromoFactureLigne" ADD CONSTRAINT "PromoFactureLigne_stockLotId_fkey"
      FOREIGN KEY ("stockLotId") REFERENCES "PromoStockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
