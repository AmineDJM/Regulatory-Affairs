-- Les postes servent désormais AUSSI les congrès nationaux : SponsoringItem devient AdProItem.
-- Deux clés étrangères nullables plutôt qu'un couple (type, id) : une colonne polymorphe ne peut
-- pas porter de contrainte, donc supprimer un congrès laisserait ses postes orphelins.
--
-- Idempotente et rejouable : gère une base qui a déjà l'ancienne table comme une base neuve.

-- 1) Renommer le type énuméré.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SponsoringItemKind')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdProItemKind') THEN
    ALTER TYPE "SponsoringItemKind" RENAME TO "AdProItemKind";
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE "AdProItemKind" AS ENUM ('STAND', 'PROMO_MATERIAL', 'SERVICE', 'TRAVEL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Renommer la table (les données existantes sont conservées).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SponsoringItem')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AdProItem') THEN
    ALTER TABLE "SponsoringItem" RENAME TO "AdProItem";
  END IF;
END
$$;

-- 3) Base neuve : créer la table directement dans sa forme finale.
CREATE TABLE IF NOT EXISTS "AdProItem" (
  "id"                 TEXT NOT NULL,
  "sponsoringId"       TEXT,
  "congressNationalId" TEXT,
  "kind"               "AdProItemKind" NOT NULL DEFAULT 'OTHER',
  "label"              TEXT NOT NULL,
  "notes"              TEXT,
  "supplier"           TEXT,
  "amountEstimated"    DECIMAL(14,2),
  "amountGranted"      DECIMAL(14,2),
  "promoMaterialId"    TEXT,
  "expenseOrderId"     TEXT,
  "addedAfterDecision" BOOLEAN NOT NULL DEFAULT false,
  "position"           INTEGER NOT NULL DEFAULT 0,
  "createdById"        TEXT,
  "updatedById"        TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProItem_pkey" PRIMARY KEY ("id")
);

-- 4) Table renommée : le parent sponsoring devient optionnel, le parent congrès apparaît.
ALTER TABLE "AdProItem" ALTER COLUMN "sponsoringId" DROP NOT NULL;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "congressNationalId" TEXT;

-- 5) Index (ceux de l'ancienne table ont suivi le renommage sous leur ancien nom : on ajoute
--    les nouveaux sans supprimer les anciens — un index en double ne casse rien).
CREATE INDEX IF NOT EXISTS "AdProItem_sponsoringId_idx" ON "AdProItem"("sponsoringId");
CREATE INDEX IF NOT EXISTS "AdProItem_congressNationalId_idx" ON "AdProItem"("congressNationalId");
CREATE INDEX IF NOT EXISTS "AdProItem_promoMaterialId_idx" ON "AdProItem"("promoMaterialId");

-- 6) Cascades : supprimer l'opération supprime ses postes (ils n'ont pas d'existence propre).
DO $$
BEGIN
  ALTER TABLE "AdProItem"
    ADD CONSTRAINT "AdProItem_sponsoringId_fkey"
    FOREIGN KEY ("sponsoringId") REFERENCES "SponsoringRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "AdProItem"
    ADD CONSTRAINT "AdProItem_congressNationalId_fkey"
    FOREIGN KEY ("congressNationalId") REFERENCES "CongressNational"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 7) EXACTEMENT un parent. Sans cette garde, un poste sans parent serait invisible partout tout
--    en pesant dans aucune ventilation — une dépense fantôme.
DO $$
BEGIN
  ALTER TABLE "AdProItem"
    ADD CONSTRAINT "AdProItem_one_parent"
    CHECK (("sponsoringId" IS NOT NULL)::int + ("congressNationalId" IS NOT NULL)::int = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 8) Le renommage a fait suivre les index et contraintes sous leur ANCIEN nom : on retire les
--    doublons, sinon chaque écriture vérifierait deux fois la même chose.
ALTER TABLE "AdProItem" DROP CONSTRAINT IF EXISTS "SponsoringItem_sponsoringId_fkey";
DROP INDEX IF EXISTS "SponsoringItem_sponsoringId_idx";
DROP INDEX IF EXISTS "SponsoringItem_promoMaterialId_idx";

-- 9) La clé primaire porte encore l'ancien nom de table : cosmétique, mais un nom qui désigne
--    une table disparue est exactement ce qui égare la personne suivante.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SponsoringItem_pkey') THEN
    ALTER TABLE "AdProItem" RENAME CONSTRAINT "SponsoringItem_pkey" TO "AdProItem_pkey";
  END IF;
END
$$;

-- 10) Un symposium sponsorisé est un poste de dépense à part entière sur un congrès. Sans nature
--     dédiée, on ne pourrait pas dire « un symposium est annoncé mais rien ne le chiffre ».
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'SYMPOSIUM';
