-- Index textuel PROGRESSIF du Drive : le texte extrait d'un fichier, mémorisé à la première
-- lecture, pour retrouver un document dont le NOM ne dit rien. Idempotent.

CREATE TABLE IF NOT EXISTS "DriveTextIndex" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textFold" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveTextIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DriveTextIndex_nodeId_key" ON "DriveTextIndex"("nodeId");
CREATE INDEX IF NOT EXISTS "DriveTextIndex_updatedAt_idx" ON "DriveTextIndex"("updatedAt");

DO $$ BEGIN
    ALTER TABLE "DriveTextIndex"
        ADD CONSTRAINT "DriveTextIndex_nodeId_fkey"
        FOREIGN KEY ("nodeId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rejouabilité : la colonne de recherche repliée peut manquer sur une base qui a déjà la table.
ALTER TABLE "DriveTextIndex" ADD COLUMN IF NOT EXISTS "textFold" TEXT NOT NULL DEFAULT '';
