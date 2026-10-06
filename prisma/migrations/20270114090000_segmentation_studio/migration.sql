-- SEGMENTATION STUDIO (Direction, 06/10 : « intègre en natif la segmentation, mets à jour ce qu'il y a sur la plateforme,
-- permets de la modifier à la main, et que tout soit relié »). Additive et idempotente : aucune table existante n'est
-- modifiée, aucune ligne n'est écrite. Les praticiens restent ceux de l'annuaire (MedicalDoctor), les produits ceux du
-- référentiel canonique (Product), la BU celle du module Business Units.

CREATE TABLE IF NOT EXISTS "SegmentationStrategie" (
  "id" TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SegmentationStrategie_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SegmentationStrategie_businessUnitId_idx" ON "SegmentationStrategie"("businessUnitId");

CREATE TABLE IF NOT EXISTS "SegmentationStrategieProduit" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "rang" INTEGER NOT NULL,
  "depuis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "jusqua" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SegmentationStrategieProduit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SegmentationStrategieProduit_strategieId_jusqua_idx" ON "SegmentationStrategieProduit"("strategieId", "jusqua");
CREATE INDEX IF NOT EXISTS "SegmentationStrategieProduit_productId_idx" ON "SegmentationStrategieProduit"("productId");
-- Au plus UN produit par rang en vigueur, et un produit n'est classé qu'une fois à la fois (index partiels).
CREATE UNIQUE INDEX IF NOT EXISTS "SegmentationStrategieProduit_rang_en_vigueur" ON "SegmentationStrategieProduit"("strategieId", "rang") WHERE "jusqua" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SegmentationStrategieProduit_produit_en_vigueur" ON "SegmentationStrategieProduit"("strategieId", "productId") WHERE "jusqua" IS NULL;

CREATE TABLE IF NOT EXISTS "SegmentationRegle" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "contenu" JSONB NOT NULL,
  "note" TEXT,
  "publieeParId" TEXT,
  "publieeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SegmentationRegle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SegmentationRegle_strategieId_version_key" ON "SegmentationRegle"("strategieId", "version");

CREATE TABLE IF NOT EXISTS "SegmentationFiche" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "statut" TEXT,
  "zone" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUEL',
  "importId" TEXT,
  "ligneSource" INTEGER,
  "retireeLe" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SegmentationFiche_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SegmentationFiche_strategieId_doctorId_key" ON "SegmentationFiche"("strategieId", "doctorId");
CREATE INDEX IF NOT EXISTS "SegmentationFiche_doctorId_idx" ON "SegmentationFiche"("doctorId");

CREATE TABLE IF NOT EXISTS "HcpObservation" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "strategieId" TEXT,
  "productId" TEXT,
  "potentiel" DECIMAL(12,2),
  "prescriptionsSur10" DECIMAL(6,2),
  "metrique" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUEL',
  "importId" TEXT,
  "ligneSource" INTEGER,
  "auteurId" TEXT,
  "observeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "commentaire" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HcpObservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HcpObservation_doctorId_observeLe_idx" ON "HcpObservation"("doctorId", "observeLe");
CREATE INDEX IF NOT EXISTS "HcpObservation_strategieId_idx" ON "HcpObservation"("strategieId");

CREATE TABLE IF NOT EXISTS "SegmentationDerogation" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "productId" TEXT,
  "nature" TEXT NOT NULL,
  "valeur" TEXT NOT NULL,
  "valeurCalculee" TEXT,
  "motif" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUEL',
  "importId" TEXT,
  "auteurId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expireLe" TIMESTAMP(3),
  "leveeLe" TIMESTAMP(3),
  "leveeParId" TEXT,
  CONSTRAINT "SegmentationDerogation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SegmentationDerogation_strategieId_doctorId_idx" ON "SegmentationDerogation"("strategieId", "doctorId");
CREATE INDEX IF NOT EXISTS "SegmentationDerogation_doctorId_idx" ON "SegmentationDerogation"("doctorId");

CREATE TABLE IF NOT EXISTS "SegmentationImport" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "nomFichier" TEXT NOT NULL,
  "empreinte" TEXT NOT NULL,
  "taille" INTEGER NOT NULL,
  "feuille" TEXT,
  "rapport" JSONB NOT NULL,
  "auteurId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SegmentationImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SegmentationImport_strategieId_empreinte_key" ON "SegmentationImport"("strategieId", "empreinte");

DO $$ BEGIN
  ALTER TABLE "SegmentationStrategie" ADD CONSTRAINT "SegmentationStrategie_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationStrategieProduit" ADD CONSTRAINT "SegmentationStrategieProduit_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationStrategieProduit" ADD CONSTRAINT "SegmentationStrategieProduit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationRegle" ADD CONSTRAINT "SegmentationRegle_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationFiche" ADD CONSTRAINT "SegmentationFiche_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationFiche" ADD CONSTRAINT "SegmentationFiche_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HcpObservation" ADD CONSTRAINT "HcpObservation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HcpObservation" ADD CONSTRAINT "HcpObservation_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationDerogation" ADD CONSTRAINT "SegmentationDerogation_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationDerogation" ADD CONSTRAINT "SegmentationDerogation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SegmentationImport" ADD CONSTRAINT "SegmentationImport_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
