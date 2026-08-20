-- LA CARTE D'IDENTITÉ LÉGALE ET FISCALE DE CHAQUE ENTITÉ.
--
-- RC, NIF, NIS, article d'imposition, RIB, siège : ces coordonnées sont demandées dix fois par
-- mois — sur un appel d'offres, une facture, un contrat, un dossier bancaire. Elles vivaient
-- dans un document Word que chacun recopiait de mémoire, avec les fautes de frappe que cela
-- suppose sur un numéro à quinze chiffres. Elles rejoignent LEGAL, module des engagements de la
-- société, et se copient d'un clic.
--
-- UN SEUL JEU PAR ENTITÉ (clé unique) : deux « identités fiscales » d'une même société seraient
-- exactement le doute qu'on vient lever. Aucune ligne n'est créée ici — on ne devine pas un
-- numéro fiscal, et une carte d'identité pré-remplie de vide se recopierait telle quelle.
-- Idempotent : rejouable sur une instance déjà migrée.

CREATE TABLE IF NOT EXISTS "CompanyLegalIdentity" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "legalName"    TEXT,
  "legalForm"    TEXT,
  "shareCapital" TEXT,
  "rcNumber"     TEXT,
  "nif"          TEXT,
  "nis"          TEXT,
  "taxArticle"   TEXT,
  "headOffice"   TEXT,
  "phone"        TEXT,
  "email"        TEXT,
  "website"      TEXT,
  "bankName"     TEXT,
  "bankAgency"   TEXT,
  "rib"          TEXT,
  "iban"         TEXT,
  "swift"        TEXT,
  "managerName"  TEXT,
  "managerTitle" TEXT,
  "notes"        TEXT,
  "updatedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyLegalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyLegalIdentity_companyId_key" ON "CompanyLegalIdentity"("companyId");

DO $$ BEGIN
  ALTER TABLE "CompanyLegalIdentity" ADD CONSTRAINT "CompanyLegalIdentity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
