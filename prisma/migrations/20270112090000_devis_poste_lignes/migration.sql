-- §118.206 — Les devis de poste Ad & Pro, LUS et structurés : lignes validables une à une, un bon de
-- commande par devis qui ne porte que les lignes validées.
-- Idempotente : rejouée, elle ne change rien. Aucune donnée d'avant n'est touchée : un devis déposé avant
-- cette règle n'a simplement pas de lignes (on peut les lire ou les saisir depuis sa carte).

CREATE TABLE IF NOT EXISTS "AdProDevis" (
  "id" TEXT NOT NULL,
  "legalDocumentId" TEXT NOT NULL,
  "supplierId" TEXT,
  "tvaRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
  "extraTaxLabel" TEXT,
  "extraTaxRate" DECIMAL(5,2),
  "announcedTotal" DECIMAL(14,2),
  "quoteDate" TIMESTAMP(3),
  "lectureId" TEXT,
  "lectureNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProDevis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProDevis_legalDocumentId_key" ON "AdProDevis"("legalDocumentId");

CREATE TABLE IF NOT EXISTS "AdProDevisLigne" (
  "id" TEXT NOT NULL,
  "devisId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "reference" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" DECIMAL(14,3),
  "unitPrice" DECIMAL(14,2),
  "lue" INTEGER,
  "aVerifier" TEXT,
  "validatedItemId" TEXT,
  "validatedAt" TIMESTAMP(3),
  "validatedById" TEXT,
  "bcId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProDevisLigne_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdProDevisLigne_devisId_idx" ON "AdProDevisLigne"("devisId");
CREATE INDEX IF NOT EXISTS "AdProDevisLigne_validatedItemId_idx" ON "AdProDevisLigne"("validatedItemId");
CREATE INDEX IF NOT EXISTS "AdProDevisLigne_bcId_idx" ON "AdProDevisLigne"("bcId");

DO $$ BEGIN
  ALTER TABLE "AdProDevis" ADD CONSTRAINT "AdProDevis_legalDocumentId_fkey"
    FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AdProDevisLigne" ADD CONSTRAINT "AdProDevisLigne_devisId_fkey"
    FOREIGN KEY ("devisId") REFERENCES "AdProDevis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AdProDevisLigne" ADD CONSTRAINT "AdProDevisLigne_validatedItemId_fkey"
    FOREIGN KEY ("validatedItemId") REFERENCES "AdProItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AdProDevisLigne" ADD CONSTRAINT "AdProDevisLigne_bcId_fkey"
    FOREIGN KEY ("bcId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
