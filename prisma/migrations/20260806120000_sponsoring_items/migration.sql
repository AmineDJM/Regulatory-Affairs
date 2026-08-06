-- Postes d'un sponsoring : de quoi est fait le montant (stand, matériel promo, prestation…).
-- Additive et idempotente : rejouable sans effet de bord.

DO $$
BEGIN
  CREATE TYPE "SponsoringItemKind" AS ENUM ('STAND', 'PROMO_MATERIAL', 'SERVICE', 'TRAVEL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "SponsoringItem" (
  "id"                 TEXT NOT NULL,
  "sponsoringId"       TEXT NOT NULL,
  "kind"               "SponsoringItemKind" NOT NULL DEFAULT 'OTHER',
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
  CONSTRAINT "SponsoringItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SponsoringItem_sponsoringId_idx" ON "SponsoringItem"("sponsoringId");
CREATE INDEX IF NOT EXISTS "SponsoringItem_promoMaterialId_idx" ON "SponsoringItem"("promoMaterialId");

-- Supprimer le sponsoring supprime ses postes : un poste n'a pas d'existence propre.
DO $$
BEGIN
  ALTER TABLE "SponsoringItem"
    ADD CONSTRAINT "SponsoringItem_sponsoringId_fkey"
    FOREIGN KEY ("sponsoringId") REFERENCES "SponsoringRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
