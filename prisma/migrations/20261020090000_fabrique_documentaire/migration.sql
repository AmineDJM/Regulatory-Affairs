-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LA FABRIQUE DE DOCUMENTS — devis, bons de commande et factures émis par Adam au nom d'une
-- société du groupe.
--
-- Deux tables, et pas de « registre des documents émis » : une pièce émise EST un
-- `LegalDocument` (nature QUOTE / PURCHASE_ORDER / INVOICE, fichier dans le Drive, chaînage
-- devis → BC → facture) — §17 : pas de second registre. Ce que le registre ne portait pas :
--
--   • `CompanyDocumentProfile` — ce qu'une société applique d'elle-même à ses pièces
--     (préfixes, TVA par défaut, conditions de paiement, validité des devis, papier en-tête,
--     signataire). Un par société ; absent = les défauts du code.
--   • `DocumentSequence` — le compteur de numérotation par société, nature et année, incrémenté
--     atomiquement. `LegalDocument.reference` n'est pas unique (les références des pièces reçues
--     sont celles des fournisseurs) : la continuité des numéros émis se tient donc ici.
--
-- Idempotent : rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "CompanyDocumentProfile" (
  "id"                TEXT NOT NULL,
  "companyId"         TEXT NOT NULL,
  "quotePrefix"       TEXT NOT NULL DEFAULT 'DEV',
  "orderPrefix"       TEXT NOT NULL DEFAULT 'BC',
  "invoicePrefix"     TEXT NOT NULL DEFAULT 'FA',
  "vatRate"           DECIMAL(5,4) NOT NULL DEFAULT 0.19,
  "paymentTerms"      TEXT,
  "quoteValidityDays" INTEGER NOT NULL DEFAULT 30,
  "footerNote"        TEXT,
  "letterheadId"      TEXT,
  "signatoryName"     TEXT,
  "signatoryTitle"    TEXT,
  "settings"          JSONB,
  "updatedById"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyDocumentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyDocumentProfile_companyId_key" ON "CompanyDocumentProfile" ("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyDocumentProfile_companyId_fkey') THEN
    ALTER TABLE "CompanyDocumentProfile"
      ADD CONSTRAINT "CompanyDocumentProfile_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DocumentSequence" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "year"      INTEGER NOT NULL,
  "last"      INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSequence_companyId_kind_year_key" ON "DocumentSequence" ("companyId", "kind", "year");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSequence_companyId_fkey') THEN
    ALTER TABLE "DocumentSequence"
      ADD CONSTRAINT "DocumentSequence_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;
