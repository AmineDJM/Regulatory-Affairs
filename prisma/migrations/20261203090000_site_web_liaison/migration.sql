-- LA LIAISON AVEC LE SITE ADVENTUM, SANS RIEN FAIRE À LA MAIN (§118.159) : les clés de liaison
-- générées par l'ERP (scellées), les candidatures déposées sur le site public, et la dernière
-- lecture de la santé du site.
--
-- Idempotent : `IF NOT EXISTS` partout, contraintes posées par bloc conditionnel. Aucune donnée
-- n'est semée : aucune clé n'existe tant qu'un Super Admin n'en a pas généré une.
-- Le circuit documenté est `db:deploy` (jamais `psql` à la main — §118.110).

CREATE TABLE IF NOT EXISTS "SiteWebCle" (
    "id"                    TEXT NOT NULL,
    "etat"                  TEXT NOT NULL DEFAULT 'ATTENTE',
    "cle"                   TEXT NOT NULL,
    "secret"                TEXT NOT NULL,
    "empreinte"             TEXT NOT NULL,
    "creeParId"             TEXT,
    "creeLe"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prochaineVerification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereVerification"  TIMESTAMP(3),
    "dernierConstat"        TEXT,
    "activeeLe"             TIMESTAMP(3),
    "retireeLe"             TIMESTAMP(3),
    CONSTRAINT "SiteWebCle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteWebCle_etat_idx" ON "SiteWebCle"("etat");
-- AU PLUS UNE clé ACTIVE et UNE clé EN ATTENTE, tenu par la base : deux clés « actives » feraient
-- signer par l'une ce que l'autre prétend garder, et rien ne le dirait.
CREATE UNIQUE INDEX IF NOT EXISTS "SiteWebCle_une_par_etat" ON "SiteWebCle"("etat") WHERE "etat" IN ('ACTIVE', 'ATTENTE');

CREATE TABLE IF NOT EXISTS "SiteCandidature" (
    "id"           TEXT NOT NULL,
    "siteId"       TEXT NOT NULL,
    "jobPostingId" TEXT,
    "offreTitre"   TEXT,
    "offreRef"     TEXT,
    "nom"          TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "telephone"    TEXT,
    "message"      TEXT,
    "cvCle"        TEXT,
    "cvNom"        TEXT,
    "cvType"       TEXT,
    "cvTaille"     INTEGER,
    "cvEmpreinte"  TEXT,
    "etat"         TEXT NOT NULL DEFAULT 'NOUVELLE',
    "motif"        TEXT,
    "candidateId"  TEXT,
    "consentement" BOOLEAN NOT NULL DEFAULT false,
    "langue"       TEXT,
    "soumiseLe"    TIMESTAMP(3) NOT NULL,
    "recueLe"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteeParId" TEXT,
    "traiteeLe"    TIMESTAMP(3),
    CONSTRAINT "SiteCandidature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteCandidature_siteId_key" ON "SiteCandidature"("siteId");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteCandidature_candidateId_key" ON "SiteCandidature"("candidateId");
CREATE INDEX IF NOT EXISTS "SiteCandidature_etat_recueLe_idx" ON "SiteCandidature"("etat", "recueLe");
CREATE INDEX IF NOT EXISTS "SiteCandidature_jobPostingId_idx" ON "SiteCandidature"("jobPostingId");

ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteSante" JSONB;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteSanteAt" TIMESTAMP(3);
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteBootId" TEXT;

DO $$
BEGIN
  -- Une candidature SURVIT à la suppression de son offre : c'est une personne qui a écrit, et sa
  -- candidature reste à traiter même si l'annonce a disparu.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteCandidature_jobPostingId_fkey') THEN
    ALTER TABLE "SiteCandidature" ADD CONSTRAINT "SiteCandidature_jobPostingId_fkey"
      FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteCandidature_candidateId_fkey') THEN
    ALTER TABLE "SiteCandidature" ADD CONSTRAINT "SiteCandidature_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "RecruitmentCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
