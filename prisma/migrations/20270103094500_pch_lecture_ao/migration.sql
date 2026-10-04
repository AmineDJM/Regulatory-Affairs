-- LES LECTURES DU DOCUMENT D'UN APPEL D'OFFRES PCH (audit 360°, lot D1c — F2).
--
-- La lecture d'avant océrisait même un PDF qui porte son texte, coupait le texte à 24 000 caractères sans le dire,
-- et AJOUTAIT ses lignes à celles des lectures précédentes. Une lecture est désormais une ligne (`PchTenderExtraction` :
-- méthode, pages, coupe, fichier gardé) et ses lignes la désignent (`extractionId`), avec ce qu'elle avait lu
-- (`empreinteExtraction`) ; `modifieeLe` dit qu'une PERSONNE a changé une ligne. Rien n'est rempli : une ligne d'avant
-- n'a ni lecture ni marque, et une lecture ne la remplace donc JAMAIS — rien ne dit que personne ne l'a touchée.
-- Idempotente.
CREATE TABLE IF NOT EXISTS "PchTenderExtraction" (
  "id" TEXT NOT NULL,
  "tenderId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "nomFichier" TEXT,
  "documentId" TEXT,
  "methode" TEXT NOT NULL,
  "confiance" INTEGER,
  "aRelire" BOOLEAN NOT NULL DEFAULT false,
  "pagesLues" INTEGER,
  "pagesTotal" INTEGER,
  "caracteres" INTEGER NOT NULL,
  "caracteresLus" INTEGER NOT NULL,
  "produits" INTEGER NOT NULL,
  "complementaire" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchTenderExtraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchTenderExtraction_tenderId_createdAt_idx" ON "PchTenderExtraction"("tenderId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "PchTenderExtraction" ADD CONSTRAINT "PchTenderExtraction_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "PchTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "extractionId" TEXT;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "empreinteExtraction" TEXT;
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "modifieeLe" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PchTenderLine_extractionId_idx" ON "PchTenderLine"("extractionId");
DO $$ BEGIN
  ALTER TABLE "PchTenderLine" ADD CONSTRAINT "PchTenderLine_extractionId_fkey"
    FOREIGN KEY ("extractionId") REFERENCES "PchTenderExtraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
