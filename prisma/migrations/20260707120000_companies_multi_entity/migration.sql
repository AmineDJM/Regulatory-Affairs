-- Batch L — dimension multi-entités (sociétés du groupe) + type de matériel promo. Idempotent.

-- ─────────────── Entités / sociétés (Adventum, Pharmagène, …) ───────────────
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Company_name_key" ON "Company"("name");
CREATE INDEX IF NOT EXISTS "Company_isActive_idx" ON "Company"("isActive");

-- Deux entités par défaut (modifiables/désactivables dans Administration).
INSERT INTO "Company" ("id", "name", "shortName", "color", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('company_adventum',  'Adventum Pharma', 'Adventum',   '#2563eb', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('company_pharmagene', 'Pharmagène',     'Pharmagène', '#16a34a', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- ─────────────── companyId sur les enregistrements clés de chaque domaine ───────────────
ALTER TABLE "RegulatoryProduct"      ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PchTender"              ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Employee"              ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "PromoMaterial"          ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "MedicalDoctor"          ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "FinanceTransaction"     ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "StockSnapshot"          ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "LogisticsOrder"         ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Sale"                   ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE INDEX IF NOT EXISTS "RegulatoryProduct_companyId_idx"      ON "RegulatoryProduct"("companyId");
CREATE INDEX IF NOT EXISTS "PchTender_companyId_idx"              ON "PchTender"("companyId");
CREATE INDEX IF NOT EXISTS "Employee_companyId_idx"               ON "Employee"("companyId");
CREATE INDEX IF NOT EXISTS "PromoMaterial_companyId_idx"          ON "PromoMaterial"("companyId");
CREATE INDEX IF NOT EXISTS "MedicalDoctor_companyId_idx"          ON "MedicalDoctor"("companyId");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_companyId_idx"     ON "FinanceTransaction"("companyId");
CREATE INDEX IF NOT EXISTS "MedicalInfoDeclaration_companyId_idx" ON "MedicalInfoDeclaration"("companyId");
CREATE INDEX IF NOT EXISTS "StockSnapshot_companyId_idx"          ON "StockSnapshot"("companyId");
CREATE INDEX IF NOT EXISTS "LogisticsOrder_companyId_idx"         ON "LogisticsOrder"("companyId");
CREATE INDEX IF NOT EXISTS "Sale_companyId_idx"                   ON "Sale"("companyId");

-- Clés étrangères (ON DELETE SET NULL : supprimer une entité délie ses enregistrements).
DO $$ BEGIN
  ALTER TABLE "RegulatoryProduct"      ADD CONSTRAINT "RegulatoryProduct_companyId_fkey"      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PchTender"              ADD CONSTRAINT "PchTender_companyId_fkey"              FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Employee"              ADD CONSTRAINT "Employee_companyId_fkey"               FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PromoMaterial"          ADD CONSTRAINT "PromoMaterial_companyId_fkey"          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "MedicalDoctor"          ADD CONSTRAINT "MedicalDoctor_companyId_fkey"          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction"     ADD CONSTRAINT "FinanceTransaction_companyId_fkey"     FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "MedicalInfoDeclaration" ADD CONSTRAINT "MedicalInfoDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "StockSnapshot"          ADD CONSTRAINT "StockSnapshot_companyId_fkey"          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LogisticsOrder"         ADD CONSTRAINT "LogisticsOrder_companyId_fkey"         FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Sale"                   ADD CONSTRAINT "Sale_companyId_fkey"                   FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────── Type de matériel promotionnel ───────────────
DO $$ BEGIN
  CREATE TYPE "MaterialType" AS ENUM (
    'PRESENTOIRE','STAND_BOOTH','CARNET_BILAN','SOUS_MAINS','BLOC_NOTE','SAC_A_DOS',
    'PORTE_CARTE_RDV','BANNER','FICHE_POSO','ADV','FICHE_CONSEILS','FICHE_GAMME',
    'POSTER','VIDEO','CADEAUX_FIN_ANNEE','CARTES_INVITATIONS','STYLOS','CLE_USB','AUTRES'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "materialType" "MaterialType";
