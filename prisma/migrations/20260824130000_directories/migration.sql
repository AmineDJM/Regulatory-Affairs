-- DEUX ANNUAIRES QUI MANQUAIENT.
--
-- 1) MedicalDirectory : une entreprise tient PLUSIEURS listes de praticiens (« Cardiologues
--    Centre », « Prescripteurs Oncologie », « Congrès 2026 »). Les fondre en une seule rend
--    chacune inutilisable, et un import destiné à une campagne pollue l'annuaire de tout le monde.
--    `SET NULL` sur le rattachement : supprimer un annuaire REND ses praticiens à l'annuaire
--    général, il ne les efface jamais.
--
-- 2) CompanyContact : tout ce qui n'est ni praticien ni salarié — agence de voyage, livreur,
--    imprimeur, agence marketing, hôtel, transitaire. Ces numéros vivent aujourd'hui dans les
--    téléphones de trois personnes ; le jour où l'une est absente, on cherche l'imprimeur sur
--    Internet.

CREATE TABLE IF NOT EXISTS "MedicalDirectory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "companyId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicalDirectory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyContact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "phoneAlt" TEXT,
  "email" TEXT,
  "website" TEXT,
  "address" TEXT,
  "city" TEXT,
  "wilaya" TEXT,
  "rc" TEXT,
  "nif" TEXT,
  "rib" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "directoryId" TEXT;

CREATE INDEX IF NOT EXISTS "MedicalDirectory_companyId_idx" ON "MedicalDirectory"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyContact_companyId_idx" ON "CompanyContact"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyContact_isActive_idx" ON "CompanyContact"("isActive");
CREATE INDEX IF NOT EXISTS "CompanyContact_kind_idx" ON "CompanyContact"("kind");
CREATE INDEX IF NOT EXISTS "MedicalDoctor_directoryId_idx" ON "MedicalDoctor"("directoryId");

DO $$ BEGIN
  ALTER TABLE "MedicalDirectory" ADD CONSTRAINT "MedicalDirectory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MedicalDoctor" ADD CONSTRAINT "MedicalDoctor_directoryId_fkey"
    FOREIGN KEY ("directoryId") REFERENCES "MedicalDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
