-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- STOCK PROMOTIONNEL, ÉTAPE 1 — LE SOCLE (§118.164)
--
-- Un catalogue à références fixes (CAT-0001…) tenu par le Super Admin, trois familles
-- (consommable, durable, numérique), des LOTS datés (coût, fin de validité), des DÉTENTEURS
-- (le magasin central, puis chaque délégué), des TRANSFERTS que celui qui reçoit confirme, et des
-- DEMANDES de matériel servies par le magasin.
--
-- ── LA REPRISE DE L'HISTORIQUE ─────────────────────────────────────────────────────────────
--
-- Chaque article de stock d'avant reçoit SON article du catalogue, un par un : deux lignes
-- « Fiche posologique » saisies à la main ne sont pas fusionnées sur la ressemblance de leur nom
-- (§118.85 — un rapprochement deviné vaut moins qu'aucun). Le Super Admin les réunira s'il le
-- décide. Tous les mouvements d'avant entrent dans UN lot « historique repris », au magasin
-- central : c'est exactement ce qu'ils décrivaient (le registre n'avait qu'un stock). Aucune
-- quantité n'est recalculée, aucun mouvement n'est réécrit — le solde après migration est le
-- solde d'avant, au mouvement près.
--
-- Les identifiants de reprise sont DÉTERMINISTES (`reprise_<id de l'article>`) : un second
-- passage retrouve ce que le premier a créé, et ne crée rien. Idempotente de bout en bout.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Les vocabulaires ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PromoFamille" AS ENUM ('CONSOMMABLE', 'DURABLE', 'NUMERIQUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoLotOrigine" AS ENUM ('SAISIE', 'OUVERTURE', 'CORRECTION', 'REPRISE', 'ACHAT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoTransfertNature" AS ENUM ('DOTATION', 'TRANSFERT', 'RETOUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoTransfertStatut" AS ENUM ('EN_ROUTE', 'RECU', 'REFUSE', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoDemandeStatut" AS ENUM ('OUVERTE', 'SERVIE', 'REFUSEE', 'ANNULEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'OPENING';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'TRANSFER_BACK';
ALTER TYPE "PromoMovementKind" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- ─── 2. Le catalogue ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoCatalogueArticle" (
  "id"           TEXT NOT NULL,
  "reference"    TEXT NOT NULL,
  "nom"          TEXT NOT NULL,
  "famille"      "PromoFamille" NOT NULL,
  "materialType" "MaterialType",
  "unite"        TEXT NOT NULL DEFAULT 'pièce',
  "description"  TEXT,
  "exigeProduit" BOOLEAN NOT NULL DEFAULT false,
  "actif"        BOOLEAN NOT NULL DEFAULT true,
  "createdById"  TEXT,
  "updatedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCatalogueArticle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCatalogueArticle_reference_key" ON "PromoCatalogueArticle"("reference");
CREATE INDEX IF NOT EXISTS "PromoCatalogueArticle_famille_actif_idx" ON "PromoCatalogueArticle"("famille", "actif");

-- ─── 3. L'article de stock : son article du catalogue, ses produits, son support numérique ───
ALTER TABLE "PromoStockItem" ADD COLUMN IF NOT EXISTS "catalogueId" TEXT;
ALTER TABLE "PromoStockItem" ADD COLUMN IF NOT EXISTS "produitsCle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoStockItem" ADD COLUMN IF NOT EXISTS "lien" TEXT;
ALTER TABLE "PromoStockItem" ADD COLUMN IF NOT EXISTS "valableJusquau" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PromoStockItem_catalogueId_idx" ON "PromoStockItem"("catalogueId");

CREATE TABLE IF NOT EXISTS "PromoStockItemProduct" (
  "itemId"    TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "PromoStockItemProduct_pkey" PRIMARY KEY ("itemId", "productId")
);
CREATE INDEX IF NOT EXISTS "PromoStockItemProduct_productId_idx" ON "PromoStockItemProduct"("productId");

-- ─── 4. Les lots ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoStockLot" (
  "id"             TEXT NOT NULL,
  "itemId"         TEXT NOT NULL,
  "numero"         INTEGER NOT NULL,
  "origine"        "PromoLotOrigine" NOT NULL,
  "recuLe"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "coutUnitaire"   DECIMAL(14,2),
  "valableJusquau" TIMESTAMP(3),
  "libelle"        TEXT,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockLot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockLot_itemId_numero_key" ON "PromoStockLot"("itemId", "numero");
CREATE INDEX IF NOT EXISTS "PromoStockLot_itemId_idx" ON "PromoStockLot"("itemId");

-- ─── 5. Les demandes de matériel, puis les transferts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PromoStockRequest" (
  "id"           TEXT NOT NULL,
  "itemId"       TEXT NOT NULL,
  "demandeurId"  TEXT NOT NULL,
  "quantite"     DECIMAL(12,3) NOT NULL,
  "note"         TEXT,
  "statut"       "PromoDemandeStatut" NOT NULL DEFAULT 'OUVERTE',
  "decideParId"  TEXT,
  "decideLe"     TIMESTAMP(3),
  "noteDecision" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoStockRequest_statut_idx" ON "PromoStockRequest"("statut");
CREATE INDEX IF NOT EXISTS "PromoStockRequest_demandeurId_statut_idx" ON "PromoStockRequest"("demandeurId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockRequest_itemId_idx" ON "PromoStockRequest"("itemId");

CREATE TABLE IF NOT EXISTS "PromoStockTransfer" (
  "id"             TEXT NOT NULL,
  "itemId"         TEXT NOT NULL,
  "nature"         "PromoTransfertNature" NOT NULL,
  "deId"           TEXT,
  "versId"         TEXT,
  "quantite"       DECIMAL(12,3) NOT NULL,
  "quantiteRecue"  DECIMAL(12,3),
  "statut"         "PromoTransfertStatut" NOT NULL DEFAULT 'EN_ROUTE',
  "note"           TEXT,
  "noteDecision"   TEXT,
  "initiateurId"   TEXT NOT NULL,
  "decideParId"    TEXT,
  "decideLe"       TIMESTAMP(3),
  "rappelEnvoyeLe" TIMESTAMP(3),
  "demandeId"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockTransfer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockTransfer_demandeId_key" ON "PromoStockTransfer"("demandeId");
CREATE INDEX IF NOT EXISTS "PromoStockTransfer_versId_statut_idx" ON "PromoStockTransfer"("versId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockTransfer_deId_statut_idx" ON "PromoStockTransfer"("deId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockTransfer_itemId_statut_idx" ON "PromoStockTransfer"("itemId", "statut");

-- ─── 6. Le mouvement : son lot, son détenteur, son transfert, ce qu'il annule ─────────────
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "holderId" TEXT;
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "transferId" TEXT;
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "annuleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockMovement_annuleId_key" ON "PromoStockMovement"("annuleId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_itemId_holderId_idx" ON "PromoStockMovement"("itemId", "holderId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_holderId_idx" ON "PromoStockMovement"("holderId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_lotId_idx" ON "PromoStockMovement"("lotId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_transferId_idx" ON "PromoStockMovement"("transferId");

-- ─── 7. La reprise : un article du catalogue PAR article d'avant ───────────────────────────
--
-- La famille se déduit de la nature : présentoir, stand et banner sont des DURABLES, le reste
-- est CONSOMMABLE. Aucun article d'avant ne devient NUMÉRIQUE : il porte des quantités, et un
-- support numérique n'en a pas — le requalifier effacerait son histoire.
--
-- Le numéro de référence continue la série existante, et ne se tronque JAMAIS : LPAD coupe une
-- chaîne plus longue que sa cible (§118.147 — « 1013 » devenait « 101 »), d'où le GREATEST.
WITH a_reprendre AS (
  SELECT i."id", i."name", i."materialType", i."unit", i."isActive", i."createdById", i."createdAt",
         ROW_NUMBER() OVER (ORDER BY i."createdAt", i."id") AS rang
  FROM "PromoStockItem" i
  WHERE i."catalogueId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "PromoCatalogueArticle" c WHERE c."id" = 'reprise_' || i."id")
), base AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING(c."reference" FROM 5) AS INTEGER)), 0) AS n
  FROM "PromoCatalogueArticle" c
  WHERE c."reference" ~ '^CAT-[0-9]+$'
)
INSERT INTO "PromoCatalogueArticle"
  ("id", "reference", "nom", "famille", "materialType", "unite", "actif", "createdById", "createdAt", "updatedAt")
SELECT
  'reprise_' || a."id",
  'CAT-' || LPAD((b.n + a.rang)::text, GREATEST(4, LENGTH((b.n + a.rang)::text)), '0'),
  a."name",
  CASE WHEN a."materialType"::text IN ('PRESENTOIRE', 'STAND_BOOTH', 'BANNER')
       THEN 'DURABLE'::"PromoFamille" ELSE 'CONSOMMABLE'::"PromoFamille" END,
  a."materialType",
  COALESCE(NULLIF(TRIM(a."unit"), ''), 'pièce'),
  a."isActive",
  a."createdById",
  a."createdAt",
  CURRENT_TIMESTAMP
FROM a_reprendre a CROSS JOIN base b
ON CONFLICT DO NOTHING;

UPDATE "PromoStockItem" i
SET "catalogueId" = 'reprise_' || i."id"
WHERE i."catalogueId" IS NULL
  AND EXISTS (SELECT 1 FROM "PromoCatalogueArticle" c WHERE c."id" = 'reprise_' || i."id");

-- Un lot « historique repris » par article qui a des mouvements sans lot — daté du premier.
INSERT INTO "PromoStockLot" ("id", "itemId", "numero", "origine", "recuLe", "libelle", "createdAt", "updatedAt")
SELECT
  'reprise_' || i."id",
  i."id",
  1,
  'REPRISE'::"PromoLotOrigine",
  COALESCE((SELECT MIN(m."occurredAt") FROM "PromoStockMovement" m WHERE m."itemId" = i."id"), i."createdAt"),
  'Historique repris (avant le registre par lots)',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PromoStockItem" i
WHERE EXISTS (SELECT 1 FROM "PromoStockMovement" m WHERE m."itemId" = i."id" AND m."lotId" IS NULL)
ON CONFLICT DO NOTHING;

UPDATE "PromoStockMovement" m
SET "lotId" = 'reprise_' || m."itemId"
WHERE m."lotId" IS NULL
  AND EXISTS (SELECT 1 FROM "PromoStockLot" l WHERE l."id" = 'reprise_' || m."itemId");

-- Plus rien n'est sans article du catalogue, plus aucun mouvement n'est sans lot.
ALTER TABLE "PromoStockItem" ALTER COLUMN "catalogueId" SET NOT NULL;
ALTER TABLE "PromoStockMovement" ALTER COLUMN "lotId" SET NOT NULL;

-- ─── 8. L'identité d'un article de stock : (société, article du catalogue, produits) ──────
--
-- COALESCE : sans lui, deux lignes SANS société ne se heurteraient jamais (NULL est distinct de
-- NULL dans un index unique), et le même article pourrait exister deux fois au magasin. Cet index
-- est une expression, que le schéma Prisma ne sait pas écrire : il vit ici, et l'écrivain de stock
-- le respecte (recherche puis création, sérialisées, avec relecture sur collision).
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockItem_identite_key"
  ON "PromoStockItem" (COALESCE("companyId", ''), "catalogueId", "produitsCle");

-- ─── 9. Les clés étrangères ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockItem_catalogueId_fkey') THEN
    ALTER TABLE "PromoStockItem" ADD CONSTRAINT "PromoStockItem_catalogueId_fkey"
      FOREIGN KEY ("catalogueId") REFERENCES "PromoCatalogueArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockItemProduct_itemId_fkey') THEN
    ALTER TABLE "PromoStockItemProduct" ADD CONSTRAINT "PromoStockItemProduct_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockItemProduct_productId_fkey') THEN
    ALTER TABLE "PromoStockItemProduct" ADD CONSTRAINT "PromoStockItemProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockLot_itemId_fkey') THEN
    ALTER TABLE "PromoStockLot" ADD CONSTRAINT "PromoStockLot_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockRequest_itemId_fkey') THEN
    ALTER TABLE "PromoStockRequest" ADD CONSTRAINT "PromoStockRequest_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockTransfer_itemId_fkey') THEN
    ALTER TABLE "PromoStockTransfer" ADD CONSTRAINT "PromoStockTransfer_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockTransfer_demandeId_fkey') THEN
    ALTER TABLE "PromoStockTransfer" ADD CONSTRAINT "PromoStockTransfer_demandeId_fkey"
      FOREIGN KEY ("demandeId") REFERENCES "PromoStockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_lotId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "PromoStockLot"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_transferId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_transferId_fkey"
      FOREIGN KEY ("transferId") REFERENCES "PromoStockTransfer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_annuleId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_annuleId_fkey"
      FOREIGN KEY ("annuleId") REFERENCES "PromoStockMovement"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;
