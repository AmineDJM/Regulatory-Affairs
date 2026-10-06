-- CONSUMPTION INTELLIGENCE (cahier des charges §23-35) : imports de consommation hospitalière normalisés, lignes au
-- format canonique traçables jusqu'à leur ligne source, mémoire des correspondances confirmées, configuration de
-- l'affinité par produit. Additive et idempotente ; aucune ligne écrite.

CREATE TABLE IF NOT EXISTS "ConsommationImport" (
  "id" TEXT NOT NULL,
  "nomFichier" TEXT NOT NULL,
  "empreinte" TEXT NOT NULL,
  "taille" INTEGER NOT NULL,
  "fichier" BYTEA,
  "statut" TEXT NOT NULL DEFAULT 'EN_REVUE',
  "analyse" JSONB NOT NULL,
  "rapport" JSONB,
  "auteurId" TEXT,
  "valideLe" TIMESTAMP(3),
  "valideParId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsommationImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConsommationImport_empreinte_key" ON "ConsommationImport"("empreinte");
CREATE INDEX IF NOT EXISTS "ConsommationImport_statut_idx" ON "ConsommationImport"("statut");

CREATE TABLE IF NOT EXISTS "ConsommationLigne" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "feuille" TEXT,
  "ligneSource" INTEGER NOT NULL,
  "periodeDebut" TIMESTAMP(3),
  "periodeFin" TIMESTAMP(3),
  "institutionId" TEXT,
  "etablissementBrut" TEXT,
  "productId" TEXT,
  "produitBrut" TEXT,
  "molecule" TEXT,
  "dosage" TEXT,
  "presentation" TEXT,
  "quantiteSource" DECIMAL(16,3),
  "uniteSource" TEXT,
  "quantite" DECIMAL(16,3),
  "unite" TEXT,
  "valeur" DECIMAL(16,2),
  "devise" TEXT,
  "confiance" INTEGER NOT NULL DEFAULT 0,
  "statut" TEXT NOT NULL DEFAULT 'A_REVOIR',
  "anomalies" JSONB,
  CONSTRAINT "ConsommationLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsommationLigne_importId_statut_idx" ON "ConsommationLigne"("importId", "statut");
CREATE INDEX IF NOT EXISTS "ConsommationLigne_productId_periodeDebut_idx" ON "ConsommationLigne"("productId", "periodeDebut");
CREATE INDEX IF NOT EXISTS "ConsommationLigne_institutionId_idx" ON "ConsommationLigne"("institutionId");

CREATE TABLE IF NOT EXISTS "ConsommationMemoire" (
  "id" TEXT NOT NULL,
  "nature" TEXT NOT NULL,
  "cle" TEXT NOT NULL,
  "valeur" TEXT NOT NULL,
  "confirmeParId" TEXT,
  "utilisations" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsommationMemoire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConsommationMemoire_nature_cle_key" ON "ConsommationMemoire"("nature", "cle");

CREATE TABLE IF NOT EXISTS "AffiniteConfig" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "panier" JSONB NOT NULL,
  "periode" TEXT NOT NULL,
  "debut" TIMESTAMP(3),
  "fin" TIMESTAMP(3),
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiniteConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiniteConfig_productId_key" ON "AffiniteConfig"("productId");

DO $$ BEGIN
  ALTER TABLE "ConsommationLigne" ADD CONSTRAINT "ConsommationLigne_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConsommationImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ConsommationLigne" ADD CONSTRAINT "ConsommationLigne_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ConsommationLigne" ADD CONSTRAINT "ConsommationLigne_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiniteConfig" ADD CONSTRAINT "AffiniteConfig_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ConsommationImport" ADD COLUMN IF NOT EXISTS "fichier" BYTEA;
