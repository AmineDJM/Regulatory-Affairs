-- MARKET 360° — l'appel d'offres devient un dossier transversal de bout en bout.
-- AO → soumission versionnée → attribution (quantités) → contrat (lien FORT au marché) →
-- avenants (deltas) → lignes contractuelles → BC à lignes → livraisons → stock → factures.
-- Idempotent : chaque objet n'est créé que s'il manque. Additif : aucune colonne supprimée,
-- aucune valeur d'énuméré retirée, aucune donnée réinterprétée. Rejouable sans dommage.

-- ── 1. ÉNUMÉRÉS ÉTENDUS ────────────────────────────────────────────────────────────────────
ALTER TYPE "PchTenderStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "PchTenderStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "PchLineStatus" ADD VALUE IF NOT EXISTS 'UNSUCCESSFUL';
ALTER TYPE "PchLineStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "LegalDocKind" ADD VALUE IF NOT EXISTS 'AMENDMENT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PCH_ORDER';

-- ── 2. PchTender : cycle de vie + responsable + BU ─────────────────────────────────────────
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "internalReference" TEXT;
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "submissionDeadline" TIMESTAMP(3);
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "responsibleId" TEXT;
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
CREATE INDEX IF NOT EXISTS "PchTender_submissionDeadline_idx" ON "PchTender"("submissionDeadline");
CREATE INDEX IF NOT EXISTS "PchTender_responsibleId_idx" ON "PchTender"("responsibleId");
DO $$ BEGIN
  ALTER TABLE "PchTender" ADD CONSTRAINT "PchTender_responsibleId_fkey"
    FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchTender" ADD CONSTRAINT "PchTender_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. PchTenderLine : attribution partielle + snapshot de dépôt ───────────────────────────
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "submittedQuantityUnits" INTEGER;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "awardedQuantityUnits" INTEGER;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "submissionSnapshot" JSONB;

-- ── 4. PchOrder : rattachement au contrat ──────────────────────────────────────────────────
ALTER TABLE "PchOrder" ADD COLUMN IF NOT EXISTS "contractId" TEXT;
CREATE INDEX IF NOT EXISTS "PchOrder_contractId_idx" ON "PchOrder"("contractId");
DO $$ BEGIN
  ALTER TABLE "PchOrder" ADD CONSTRAINT "PchOrder_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. LegalDocument : lien fort au marché + avenants ──────────────────────────────────────
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "tenderId" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "amendsId" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "amountDelta" DECIMAL(14,2);
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "effectiveAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "LegalDocument_tenderId_idx" ON "LegalDocument"("tenderId");
CREATE INDEX IF NOT EXISTS "LegalDocument_amendsId_idx" ON "LegalDocument"("amendsId");
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "PchTender"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_amendsId_fkey"
    FOREIGN KEY ("amendsId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. PchSubmission : versions de préparation, verrou du dépôt ────────────────────────────
CREATE TABLE IF NOT EXISTS "PchSubmission" (
  "id"          TEXT NOT NULL,
  "tenderId"    TEXT NOT NULL,
  "version"     INTEGER NOT NULL,
  "label"       TEXT,
  "status"      TEXT NOT NULL DEFAULT 'DRAFT',
  "checklist"   JSONB,
  "notes"       TEXT,
  "submittedAt" TIMESTAMP(3),
  "lockedAt"    TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PchSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PchSubmission_tenderId_version_key" ON "PchSubmission"("tenderId", "version");
CREATE INDEX IF NOT EXISTS "PchSubmission_tenderId_idx" ON "PchSubmission"("tenderId");
DO $$ BEGIN
  ALTER TABLE "PchSubmission" ADD CONSTRAINT "PchSubmission_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "PchTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. PchContractLine : lignes du contrat et deltas d'avenants ────────────────────────────
CREATE TABLE IF NOT EXISTS "PchContractLine" (
  "id"            TEXT NOT NULL,
  "documentId"    TEXT NOT NULL,
  "contractId"    TEXT NOT NULL,
  "tenderLineId"  TEXT,
  "productId"     TEXT,
  "designation"   TEXT NOT NULL,
  "quantityUnits" INTEGER NOT NULL,
  "unitPriceDzd"  DECIMAL(14,2),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PchContractLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchContractLine_contractId_idx" ON "PchContractLine"("contractId");
CREATE INDEX IF NOT EXISTS "PchContractLine_documentId_idx" ON "PchContractLine"("documentId");
CREATE INDEX IF NOT EXISTS "PchContractLine_tenderLineId_idx" ON "PchContractLine"("tenderLineId");
CREATE INDEX IF NOT EXISTS "PchContractLine_productId_idx" ON "PchContractLine"("productId");
DO $$ BEGIN
  ALTER TABLE "PchContractLine" ADD CONSTRAINT "PchContractLine_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchContractLine" ADD CONSTRAINT "PchContractLine_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchContractLine" ADD CONSTRAINT "PchContractLine_tenderLineId_fkey"
    FOREIGN KEY ("tenderLineId") REFERENCES "PchTenderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchContractLine" ADD CONSTRAINT "PchContractLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. PchOrderLine : les lignes du bon de commande ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PchOrderLine" (
  "id"             TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "contractLineId" TEXT,
  "tenderLineId"   TEXT,
  "designation"    TEXT NOT NULL,
  "quantityUnits"  INTEGER NOT NULL DEFAULT 0,
  "unitPriceDzd"   DECIMAL(14,2),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchOrderLine_orderId_idx" ON "PchOrderLine"("orderId");
CREATE INDEX IF NOT EXISTS "PchOrderLine_contractLineId_idx" ON "PchOrderLine"("contractLineId");
CREATE INDEX IF NOT EXISTS "PchOrderLine_tenderLineId_idx" ON "PchOrderLine"("tenderLineId");
DO $$ BEGIN
  ALTER TABLE "PchOrderLine" ADD CONSTRAINT "PchOrderLine_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "PchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchOrderLine" ADD CONSTRAINT "PchOrderLine_contractLineId_fkey"
    FOREIGN KEY ("contractLineId") REFERENCES "PchContractLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchOrderLine" ADD CONSTRAINT "PchOrderLine_tenderLineId_fkey"
    FOREIGN KEY ("tenderLineId") REFERENCES "PchTenderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. PchDelivery + lignes : livraisons multiples par BC ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "PchDelivery" (
  "id"           TEXT NOT NULL,
  "orderId"      TEXT NOT NULL,
  "reference"    TEXT,
  "expectedAt"   TIMESTAMP(3),
  "deliveredAt"  TIMESTAMP(3),
  "location"     TEXT,
  "reserves"     TEXT,
  "notes"        TEXT,
  "receivedById" TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PchDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchDelivery_orderId_idx" ON "PchDelivery"("orderId");
CREATE INDEX IF NOT EXISTS "PchDelivery_deliveredAt_idx" ON "PchDelivery"("deliveredAt");
DO $$ BEGIN
  ALTER TABLE "PchDelivery" ADD CONSTRAINT "PchDelivery_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "PchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PchDeliveryLine" (
  "id"            TEXT NOT NULL,
  "deliveryId"    TEXT NOT NULL,
  "orderLineId"   TEXT,
  "designation"   TEXT NOT NULL,
  "quantityUnits" INTEGER NOT NULL DEFAULT 0,
  "batchNumber"   TEXT,
  "expiryDate"    TIMESTAMP(3),
  CONSTRAINT "PchDeliveryLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchDeliveryLine_deliveryId_idx" ON "PchDeliveryLine"("deliveryId");
CREATE INDEX IF NOT EXISTS "PchDeliveryLine_orderLineId_idx" ON "PchDeliveryLine"("orderLineId");
DO $$ BEGIN
  ALTER TABLE "PchDeliveryLine" ADD CONSTRAINT "PchDeliveryLine_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "PchDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PchDeliveryLine" ADD CONSTRAINT "PchDeliveryLine_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "PchOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 10. StockMovement : lien à la livraison ────────────────────────────────────────────────
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "deliveryId" TEXT;
CREATE INDEX IF NOT EXISTS "StockMovement_deliveryId_idx" ON "StockMovement"("deliveryId");
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "PchDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 11. MailEntryLink : « Relier à… » multiple des courriers ───────────────────────────────
CREATE TABLE IF NOT EXISTS "MailEntryLink" (
  "id"          TEXT NOT NULL,
  "entryId"     TEXT NOT NULL,
  "entityType"  "EntityType" NOT NULL,
  "entityId"    TEXT NOT NULL,
  "label"       TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailEntryLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailEntryLink_entryId_entityType_entityId_key"
  ON "MailEntryLink"("entryId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "MailEntryLink_entityType_entityId_idx" ON "MailEntryLink"("entityType", "entityId");
DO $$ BEGIN
  ALTER TABLE "MailEntryLink" ADD CONSTRAINT "MailEntryLink_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "MailEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 12. BACKFILL : chaque BC mono-ligne existant reçoit sa ligne détaillée ─────────────────
-- `lineId` reste en place (l'écran logistique le lit encore) ; la nouvelle table devient la
-- vérité des lignes. Idempotent : on ne crée pas de doublon si la ligne existe déjà.
INSERT INTO "PchOrderLine" ("id", "orderId", "tenderLineId", "designation", "quantityUnits", "createdAt")
SELECT
  'pol_' || o."id",
  o."id",
  o."lineId",
  COALESCE(l."designation", o."products", 'Bon de commande'),
  o."quantity",
  o."createdAt"
FROM "PchOrder" o
LEFT JOIN "PchTenderLine" l ON l."id" = o."lineId"
WHERE NOT EXISTS (SELECT 1 FROM "PchOrderLine" ol WHERE ol."orderId" = o."id");
