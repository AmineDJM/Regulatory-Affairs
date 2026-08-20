-- RELANCE DE MISE À JOUR DES DOSSIERS RÉGULATORY
--
-- Une ligne PAR PERSONNE relancée, même quand la relance visait tout le monde : c'est ce qui
-- permet d'afficher « dernière relance il y a 3 jours » en face de chacun, et donc de ne pas
-- harceler quelqu'un qu'on vient de relancer.
--
-- Idempotent : ce fichier peut se rejouer sans erreur sur une base déjà migrée.

CREATE TABLE IF NOT EXISTS "RegulatoryUpdateReminder" (
    "id"           TEXT NOT NULL,
    "recipientId"  TEXT NOT NULL,
    "senderId"     TEXT,
    "dossierCount" INTEGER NOT NULL DEFAULT 0,
    "staleCount"   INTEGER NOT NULL DEFAULT 0,
    "toEveryone"   BOOLEAN NOT NULL DEFAULT false,
    "note"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryUpdateReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegulatoryUpdateReminder_recipientId_createdAt_idx"
    ON "RegulatoryUpdateReminder"("recipientId", "createdAt");

CREATE INDEX IF NOT EXISTS "RegulatoryUpdateReminder_createdAt_idx"
    ON "RegulatoryUpdateReminder"("createdAt");

-- Le destinataire disparaît avec son compte (CASCADE) : une relance sans destinataire ne répond
-- plus à aucune question. L'EXPÉDITEUR, lui, est détaché (SET NULL) : la relance a bien eu lieu,
-- et l'effacer parce que le directeur a quitté la société réécrirait l'histoire.
DO $$
BEGIN
    ALTER TABLE "RegulatoryUpdateReminder"
        ADD CONSTRAINT "RegulatoryUpdateReminder_recipientId_fkey"
        FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RegulatoryUpdateReminder"
        ADD CONSTRAINT "RegulatoryUpdateReminder_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
