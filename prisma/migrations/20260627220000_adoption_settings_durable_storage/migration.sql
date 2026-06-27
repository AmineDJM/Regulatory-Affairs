-- Snapshot du score d'adoption sur l'utilisateur (pastille de la barre du haut)
ALTER TABLE "User" ADD COLUMN "adoptionScore" INTEGER;
ALTER TABLE "User" ADD COLUMN "adoptionScoreAt" TIMESTAMP(3);

-- Réglage du score d'adoption (poids + seuils), défini par le Super Admin
CREATE TABLE "AdoptionSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "wRegularity" INTEGER NOT NULL DEFAULT 22,
    "wTime" INTEGER NOT NULL DEFAULT 10,
    "wBreadth" INTEGER NOT NULL DEFAULT 15,
    "wDiversity" INTEGER NOT NULL DEFAULT 12,
    "wDurable" INTEGER NOT NULL DEFAULT 15,
    "wInteraction" INTEGER NOT NULL DEFAULT 18,
    "wRecency" INTEGER NOT NULL DEFAULT 8,
    "tChampion" INTEGER NOT NULL DEFAULT 80,
    "tActive" INTEGER NOT NULL DEFAULT 60,
    "tModerate" INTEGER NOT NULL DEFAULT 40,
    "tWeak" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "AdoptionSetting_pkey" PRIMARY KEY ("id")
);

-- Stockage durable des fichiers de documents (contenu chiffré dans FileBlob)
CREATE TABLE "StoredFile" (
    "key" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "StoredFile_blobId_idx" ON "StoredFile"("blobId");
