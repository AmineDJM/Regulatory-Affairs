-- FICHES HÔTELLERIE D'UN POSTE AD&PRO (Direction, 06/10).
--
-- « Si c'est la prise en charge de l'hôtellerie, on fait une fiche hôtellerie pour chaque
-- personne. » Une fiche par personne logée, sur le modèle du voyageur d'un poste « billetterie » :
-- nom obligatoire, le reste facultatif. La pièce d'identité est un `Document` du poste dont
-- `stepKey` est l'identifiant de la fiche (aucune colonne).
--
-- IDEMPOTENTE : rejouable sans effet.

CREATE TABLE IF NOT EXISTS "AdProHebergement" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "prenom" TEXT,
  "hotel" TEXT,
  "ville" TEXT,
  "dateArrivee" TIMESTAMP(3),
  "dateDepart" TIMESTAMP(3),
  "typeChambre" TEXT,
  "notes" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdProHebergement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdProHebergement_itemId_idx" ON "AdProHebergement"("itemId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProHebergement_itemId_fkey') THEN
    ALTER TABLE "AdProHebergement" ADD CONSTRAINT "AdProHebergement_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
