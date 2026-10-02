-- POSTES AD & PRO PLUS SIMPLES — répartition d'un sponsoring indirect, voyageurs d'une billetterie (§118.175).
--
-- Décisions de la Direction (01/10) :
--   • « si c'est un sponsoring indirect, on doit donner la ou les natures : 1 000 000 DZD répartis en
--     400 000 d'imprimerie et 600 000 d'hôtellerie » — une nature « Imprimerie » de plus, et un lien
--     (`repartitionId`) entre les postes nés d'une même répartition ;
--   • « pour la billetterie, sélectionner à chaque fois le nom de la personne, les dates de départ et
--     de retour, le passeport… avec de la flexibilité ; les demandes de réservation vont à
--     l'assistante de direction et ouvrent un sujet » — une table de voyageurs par poste, et le
--     sujet de réservation que le poste retient (`reservationDossierId`).
--
-- IDEMPOTENTE. Rien n'est retouché dans les postes existants : un sponsoring indirect déjà soumis
-- ou accordé garde sa forme (la répartition ne s'impose qu'à un poste encore modifiable).
--
-- `ADD VALUE` n'est utilisé par AUCUNE autre instruction de ce fichier : Postgres refuse d'employer
-- une valeur d'énumération dans la transaction qui l'ajoute.

ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'PRINTING';

ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "repartitionId" TEXT;
CREATE INDEX IF NOT EXISTS "AdProItem_repartitionId_idx" ON "AdProItem"("repartitionId");

ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "reservationDossierId" TEXT;
DO $$ BEGIN
  ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_reservationDossierId_fkey"
    FOREIGN KEY ("reservationDossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "AdProItem_reservationDossierId_idx" ON "AdProItem"("reservationDossierId");

CREATE TABLE IF NOT EXISTS "AdProVoyageur" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "villeDepart" TEXT,
  "villeArrivee" TEXT,
  "dateDepart" TIMESTAMP(3),
  "dateRetour" TIMESTAMP(3),
  "notes" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdProVoyageur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdProVoyageur_itemId_idx" ON "AdProVoyageur"("itemId");
DO $$ BEGIN
  ALTER TABLE "AdProVoyageur" ADD CONSTRAINT "AdProVoyageur_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
