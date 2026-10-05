-- LOT D2 — LIRE LES PIÈCES COMMERCIALES. Une lecture est une PROPOSITION (§118.152 i) : rien ici n'est un prix de
-- la société. Une lecture par empreinte SHA-256 des octets et version du lecteur ; qui a confirmé quoi ; la lecture
-- des LIGNES par un modèle, COUPÉE par défaut. Rien n'est rempli. Idempotente.
CREATE TABLE IF NOT EXISTS "LecturePiece" (
  "id" TEXT NOT NULL,
  "empreinte" TEXT NOT NULL,
  "versionLecteur" INTEGER NOT NULL,
  "etat" TEXT NOT NULL DEFAULT 'EN_COURS',
  "extension" TEXT NOT NULL,
  "taille" INTEGER NOT NULL,
  "methode" TEXT,
  "moteur" TEXT,
  "confiance" INTEGER,
  "aRelire" BOOLEAN NOT NULL DEFAULT false,
  "ocrTente" BOOLEAN NOT NULL DEFAULT false,
  "ocrEchoue" BOOLEAN NOT NULL DEFAULT false,
  "pagesLues" INTEGER,
  "pagesTotal" INTEGER,
  "caracteres" INTEGER NOT NULL DEFAULT 0,
  "tronque" BOOLEAN NOT NULL DEFAULT false,
  "texteScelle" TEXT,
  "entetes" JSONB,
  "structure" JSONB,
  "structureePar" TEXT,
  "raisonSansLignes" TEXT,
  "creeParId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LecturePiece_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LecturePiece_empreinte_versionLecteur_key" ON "LecturePiece"("empreinte", "versionLecteur");
CREATE INDEX IF NOT EXISTS "LecturePiece_etat_updatedAt_idx" ON "LecturePiece"("etat", "updatedAt");

CREATE TABLE IF NOT EXISTS "LecturePieceConfirmation" (
  "id" TEXT NOT NULL,
  "lectureId" TEXT NOT NULL,
  "cibleType" TEXT NOT NULL,
  "cibleId" TEXT NOT NULL,
  "confirmeeParId" TEXT NOT NULL,
  "confirmeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lignes" JSONB NOT NULL,
  "controle" JSONB,
  CONSTRAINT "LecturePieceConfirmation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LecturePieceConfirmation_cibleType_cibleId_idx" ON "LecturePieceConfirmation"("cibleType", "cibleId");
CREATE INDEX IF NOT EXISTS "LecturePieceConfirmation_lectureId_idx" ON "LecturePieceConfirmation"("lectureId");
DO $$ BEGIN
  ALTER TABLE "LecturePieceConfirmation" ADD CONSTRAINT "LecturePieceConfirmation_lectureId_fkey"
    FOREIGN KEY ("lectureId") REFERENCES "LecturePiece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "AiSetting" ADD COLUMN IF NOT EXISTS "lecturePiecesEnabled" BOOLEAN NOT NULL DEFAULT false;
