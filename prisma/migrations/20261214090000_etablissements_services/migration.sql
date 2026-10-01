-- LES SERVICES DES ÉTABLISSEMENTS, ET LES SECTEURS QUI EN CHOISISSENT CERTAINS (§118.172).
--
-- Idempotente : chaque objet se crée « s'il n'existe pas ». Aucune donnée n'est réécrite : un
-- lien secteur ↔ établissement d'avant couvre TOUS les services (`tousLesServices` = vrai par
-- défaut), c'est-à-dire exactement ce qu'il couvrait — un territoire ne change pas de forme
-- parce qu'une colonne est apparue.

CREATE TABLE IF NOT EXISTS "MedicalInstitutionService" (
  "id"            TEXT         NOT NULL,
  "institutionId" TEXT         NOT NULL,
  "name"          TEXT         NOT NULL,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicalInstitutionService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MedicalInstitutionService_institutionId_idx"
  ON "MedicalInstitutionService" ("institutionId");

-- UN NOM PAR ÉTABLISSEMENT, sans égard à la casse ni aux espaces de bord : « Cardiologie » et
-- « cardiologie  » sont le même service. Index d'EXPRESSION — Prisma ne sait pas l'écrire.
CREATE UNIQUE INDEX IF NOT EXISTS "MedicalInstitutionService_institution_nom_key"
  ON "MedicalInstitutionService" ("institutionId", lower(btrim("name")));

DO $$ BEGIN
  ALTER TABLE "MedicalInstitutionService"
    ADD CONSTRAINT "MedicalInstitutionService_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LE SERVICE D'UN PRATICIEN. Supprimer le service le laisse en place, sans service.
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
CREATE INDEX IF NOT EXISTS "MedicalDoctor_serviceId_idx" ON "MedicalDoctor" ("serviceId");
DO $$ BEGIN
  ALTER TABLE "MedicalDoctor"
    ADD CONSTRAINT "MedicalDoctor_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "MedicalInstitutionService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LE SECTEUR : tout l'établissement (défaut, et l'existant), ou certains services.
ALTER TABLE "SalesSectorInstitution" ADD COLUMN IF NOT EXISTS "tousLesServices" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "SalesSectorInstitutionService" (
  "id"                  TEXT NOT NULL,
  "sectorInstitutionId" TEXT NOT NULL,
  "serviceId"           TEXT NOT NULL,
  CONSTRAINT "SalesSectorInstitutionService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesSectorInstitutionService_sectorInstitutionId_serviceId_key"
  ON "SalesSectorInstitutionService" ("sectorInstitutionId", "serviceId");
CREATE INDEX IF NOT EXISTS "SalesSectorInstitutionService_serviceId_idx"
  ON "SalesSectorInstitutionService" ("serviceId");

DO $$ BEGIN
  ALTER TABLE "SalesSectorInstitutionService"
    ADD CONSTRAINT "SalesSectorInstitutionService_sectorInstitutionId_fkey"
    FOREIGN KEY ("sectorInstitutionId") REFERENCES "SalesSectorInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesSectorInstitutionService"
    ADD CONSTRAINT "SalesSectorInstitutionService_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "MedicalInstitutionService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
