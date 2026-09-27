-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- MATÉRIEL PROMOTIONNEL — LE CIRCUIT PAR DEVIS RETRANSCRITS (§118.152)
--
-- La Direction : « le demandeur crée la demande, elle est validée (la directrice marketing pour
-- quelqu'un du marketing, sinon le N+1 — jamais au-delà du directeur des opérations) ; il clique
-- sur « demander les devis », qui partent à l'assistante de direction ; elle les RETRANSCRIT dans
-- un tableau interne — référence, unité, prix unitaire, prix total, par agence ; le demandeur
-- valide un devis complet ou des lignes de plusieurs devis ; la Direction Marketing valide (sauf
-- si c'est elle qui demande), le Directeur Général au-delà du seuil Ad&Pro ; les bons de commande
-- sont GÉNÉRÉS par la plateforme ; une facture par BC, obligatoire pour demander un paiement ; et
-- à chaque paiement, une demande de visa publicitaire ou une déclaration au ministère part à
-- l'information médicale. »
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────────────────────
--
-- Elle ne change le circuit d'AUCUN dossier existant : `circuitVersion` vaut 1 par défaut, et un
-- dossier déjà en vol garde la chaîne qui lui avait été promise (§118.142). Seules les demandes
-- créées — ou basculées — après elle suivent le nouveau circuit.
--
-- Idempotente : chaque instruction est sans effet au second passage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Le dossier porte sa version de circuit et ses validateurs figés ────────────────────
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "circuitVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "requestValidatorId" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "requestValidation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "marketingValidatorId" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "quotesRequestedAt" TIMESTAMP(3);
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "quotesRequestedById" TEXT;

-- ─── 2. Les devis retranscrits ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoQuote" (
  "id"                    TEXT NOT NULL,
  "promoMaterialId"       TEXT NOT NULL,
  "position"              INTEGER NOT NULL DEFAULT 0,
  "supplierId"            TEXT,
  "supplierName"          TEXT NOT NULL,
  "reference"             TEXT,
  "quoteDate"             TIMESTAMP(3),
  "tvaRate"               DECIMAL(5,2) NOT NULL DEFAULT 19,
  "extraTaxLabel"         TEXT,
  "extraTaxRate"          DECIMAL(5,2),
  "announcedTotal"        DECIMAL(14,2),
  "documentId"            TEXT,
  "note"                  TEXT,
  "purchaseOrderId"       TEXT,
  "purchaseOrderSentAt"   TIMESTAMP(3),
  "purchaseOrderSentById" TEXT,
  "createdById"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoQuote_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PromoQuote" ADD COLUMN IF NOT EXISTS "extraTaxLabel" TEXT;
ALTER TABLE "PromoQuote" ADD COLUMN IF NOT EXISTS "extraTaxRate" DECIMAL(5,2);
CREATE INDEX IF NOT EXISTS "PromoQuote_promoMaterialId_idx" ON "PromoQuote"("promoMaterialId");
CREATE INDEX IF NOT EXISTS "PromoQuote_purchaseOrderId_idx" ON "PromoQuote"("purchaseOrderId");

DO $$ BEGIN
  ALTER TABLE "PromoQuote" ADD CONSTRAINT "PromoQuote_promoMaterialId_fkey"
    FOREIGN KEY ("promoMaterialId") REFERENCES "PromoMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PromoQuote" ADD CONSTRAINT "PromoQuote_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Les lignes de devis ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoQuoteLine" (
  "id"        TEXT NOT NULL,
  "quoteId"   TEXT NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "reference" TEXT NOT NULL,
  "unit"      TEXT,
  "quantity"  DECIMAL(14,3) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "selected"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoQuoteLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoQuoteLine_quoteId_idx" ON "PromoQuoteLine"("quoteId");

DO $$ BEGIN
  ALTER TABLE "PromoQuoteLine" ADD CONSTRAINT "PromoQuoteLine_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "PromoQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
