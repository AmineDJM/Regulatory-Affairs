-- §118.204 — Postes Ad & Pro : validation en deux temps (Direction des opérations, puis Direction
-- Marketing), assistante du bon de commande, et pièces du registre Legal rattachées aux postes.
-- Idempotente : rejouée, elle ne change rien.

ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "bcAssistantId" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "opsDecidedAt" TIMESTAMP(3);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "opsDecidedById" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "opsDecisionNote" TEXT;

DO $$ BEGIN
  CREATE TYPE "AdProPieceNature" AS ENUM ('DEVIS', 'BON_DE_COMMANDE', 'FACTURE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AdProItemPiece" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "legalDocumentId" TEXT NOT NULL,
  "nature" "AdProPieceNature" NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProItemPiece_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProItemPiece_itemId_legalDocumentId_key" ON "AdProItemPiece"("itemId", "legalDocumentId");
CREATE INDEX IF NOT EXISTS "AdProItemPiece_legalDocumentId_idx" ON "AdProItemPiece"("legalDocumentId");

DO $$ BEGIN
  ALTER TABLE "AdProItemPiece" ADD CONSTRAINT "AdProItemPiece_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AdProItemPiece" ADD CONSTRAINT "AdProItemPiece_legalDocumentId_fkey"
    FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LES POSTES DÉJÀ EN ATTENTE au déploiement : ils attendaient UNE décision, que la Direction ou la
-- Direction Marketing pouvait prendre. On ne leur ajoute pas après coup une étape qu'on ne leur avait
-- pas promise : la validation de la Direction des opérations est réputée faite (tracée), et la
-- Direction Marketing tranche. Seuls les postes soumis APRÈS ce déploiement passent par les deux temps.
UPDATE "AdProItem"
   SET "opsDecidedAt" = COALESCE("submittedAt", "updatedAt"),
       "opsDecisionNote" = 'Soumis avant la validation en deux temps (§118.204) : réputé validé par la Direction des opérations.'
 WHERE "status" = 'PENDING' AND "opsDecidedAt" IS NULL;

-- LES BC DÉJÀ ÉTABLIS pour un poste (demande de pièce acceptée et classée dans Legal) : le lien
-- devient explicite, pour que le poste montre sa pièce.
INSERT INTO "AdProItemPiece" ("id", "itemId", "legalDocumentId", "nature", "createdAt")
SELECT 'mig_' || md5(dr."entityId" || ':' || dr."legalDocumentId"), dr."entityId", dr."legalDocumentId", 'BON_DE_COMMANDE', dr."createdAt"
  FROM "DocumentRequest" dr
  JOIN "AdProItem" i ON i."id" = dr."entityId"
  JOIN "LegalDocument" l ON l."id" = dr."legalDocumentId"
 WHERE dr."entityType" = 'AD_PRO_ITEM' AND dr."legalDocumentId" IS NOT NULL AND l."kind" = 'PURCHASE_ORDER'
ON CONFLICT ("itemId", "legalDocumentId") DO NOTHING;
