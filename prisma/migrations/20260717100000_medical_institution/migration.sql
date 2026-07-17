-- Établissements médicaux : référentiel + rattachement des praticiens + backfill du texte libre.

DO $$ BEGIN
  CREATE TYPE "InstitutionType" AS ENUM ('CHU','EPH','EHS','CLINIQUE_PRIVEE','POLYCLINIQUE','CABINET','CENTRE_SANTE','PHARMACIE','GROSSISTE','AUTRE');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "InstitutionSector" AS ENUM ('PUBLIC','PRIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "MedicalInstitution" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "type"        "InstitutionType" NOT NULL DEFAULT 'AUTRE',
  "sector"      "InstitutionSector" NOT NULL DEFAULT 'PUBLIC',
  "wilaya"      TEXT,
  "city"        TEXT,
  "region"      TEXT,
  "address"     TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "notes"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalInstitution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MedicalInstitution_type_idx" ON "MedicalInstitution"("type");
CREATE INDEX IF NOT EXISTS "MedicalInstitution_wilaya_idx" ON "MedicalInstitution"("wilaya");
CREATE INDEX IF NOT EXISTS "MedicalInstitution_name_idx" ON "MedicalInstitution"("name");

ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
CREATE INDEX IF NOT EXISTS "MedicalDoctor_institutionId_idx" ON "MedicalDoctor"("institutionId");

DO $$ BEGIN
  ALTER TABLE "MedicalDoctor" ADD CONSTRAINT "MedicalDoctor_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Backfill (idempotent) : un établissement par libellé distinct non vide, puis rattachement.
INSERT INTO "MedicalInstitution" ("id","name","type","sector","updatedAt")
SELECT gen_random_uuid()::text, t.name, 'AUTRE', 'PUBLIC', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT trim("institution") AS name FROM "MedicalDoctor" WHERE "institution" IS NOT NULL AND trim("institution") <> '') t
WHERE NOT EXISTS (SELECT 1 FROM "MedicalInstitution" mi WHERE lower(mi."name") = lower(t.name));

UPDATE "MedicalDoctor" d
SET "institutionId" = mi."id"
FROM "MedicalInstitution" mi
WHERE d."institutionId" IS NULL
  AND d."institution" IS NOT NULL AND trim(d."institution") <> ''
  AND lower(trim(d."institution")) = lower(mi."name");
