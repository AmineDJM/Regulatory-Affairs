-- LES SECTEURS DE LA FORCE DE VENTE — une sélection d'hôpitaux qui porte un nom.
--
-- Idempotent : `IF NOT EXISTS` partout, contraintes posées par bloc conditionnel. Le circuit
-- documenté est `db:deploy` (jamais `psql` à la main : une migration appliquée hors du chemin
-- documenté est invisible au mécanisme qui vérifie qu'elle a été appliquée — §118.110).

CREATE TABLE IF NOT EXISTS "SalesSector" (
    "id"             TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "city"           TEXT,
    "color"          TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesSector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesSectorInstitution" (
    "id"            TEXT NOT NULL,
    "sectorId"      TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesSectorInstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesSectorRep" (
    "id"         TEXT NOT NULL,
    "sectorId"   TEXT NOT NULL,
    "repId"      TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesSectorRep_pkey" PRIMARY KEY ("id")
);

-- Deux secteurs « Est » dans la même BU sont une erreur de saisie, pas deux territoires.
CREATE UNIQUE INDEX IF NOT EXISTS "SalesSector_businessUnitId_name_key" ON "SalesSector"("businessUnitId", "name");
CREATE INDEX IF NOT EXISTS "SalesSector_businessUnitId_idx" ON "SalesSector"("businessUnitId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesSectorInstitution_sectorId_institutionId_key" ON "SalesSectorInstitution"("sectorId", "institutionId");
CREATE INDEX IF NOT EXISTS "SalesSectorInstitution_institutionId_idx" ON "SalesSectorInstitution"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesSectorRep_sectorId_repId_key" ON "SalesSectorRep"("sectorId", "repId");
CREATE INDEX IF NOT EXISTS "SalesSectorRep_repId_idx" ON "SalesSectorRep"("repId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesSector_businessUnitId_fkey') THEN
    ALTER TABLE "SalesSector" ADD CONSTRAINT "SalesSector_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesSectorInstitution_sectorId_fkey') THEN
    ALTER TABLE "SalesSectorInstitution" ADD CONSTRAINT "SalesSectorInstitution_sectorId_fkey"
      FOREIGN KEY ("sectorId") REFERENCES "SalesSector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesSectorInstitution_institutionId_fkey') THEN
    ALTER TABLE "SalesSectorInstitution" ADD CONSTRAINT "SalesSectorInstitution_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesSectorRep_sectorId_fkey') THEN
    ALTER TABLE "SalesSectorRep" ADD CONSTRAINT "SalesSectorRep_sectorId_fkey"
      FOREIGN KEY ("sectorId") REFERENCES "SalesSector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesSectorRep_repId_fkey') THEN
    ALTER TABLE "SalesSectorRep" ADD CONSTRAINT "SalesSectorRep_repId_fkey"
      FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
