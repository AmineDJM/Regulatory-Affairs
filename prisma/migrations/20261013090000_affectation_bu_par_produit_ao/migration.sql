-- ════════════════════════════════════════════════════════════════════════════════════════════
-- L'AFFECTATION SE FAIT PAR PRODUIT, PAS PAR MARCHÉ.
--
-- `PchTender.businessUnitId` posait UNE Business Unit pour tout l'appel d'offres. Or un marché
-- PCH porte vingt lots qui relèvent de gammes différentes — l'oncologie et l'anti-infectieux dans
-- le même bordereau. Le champ unique obligeait à n'en nommer qu'une, et les dix-neuf autres lots
-- se retrouvaient rattachés à la mauvaise équipe, ou à aucune.
--
-- L'affectation devient donc PAR LOT et MULTIPLE : deux BU peuvent légitimement se partager un
-- même produit (une gamme ville, une gamme hôpital sur la même molécule).
--
-- LE CHAMP DU MARCHÉ SURVIT et n'est pas repris : il porte l'historique des marchés déjà
-- rattachés à une gamme, et le recopier sur chaque lot affirmerait, pour les vingt, ce qui n'a
-- été décidé que pour l'ensemble. L'affectation par produit se pose à la main, en la sachant.
-- ════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PchTenderLineBusinessUnit" (
  "id"             TEXT NOT NULL,
  "tenderLineId"   TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchTenderLineBusinessUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PchTenderLineBusinessUnit_tenderLineId_businessUnitId_key"
  ON "PchTenderLineBusinessUnit"("tenderLineId", "businessUnitId");
CREATE INDEX IF NOT EXISTS "PchTenderLineBusinessUnit_businessUnitId_idx"
  ON "PchTenderLineBusinessUnit"("businessUnitId");

DO $$
BEGIN
  ALTER TABLE "PchTenderLineBusinessUnit"
    ADD CONSTRAINT "PchTenderLineBusinessUnit_tenderLineId_fkey"
    FOREIGN KEY ("tenderLineId") REFERENCES "PchTenderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PchTenderLineBusinessUnit"
    ADD CONSTRAINT "PchTenderLineBusinessUnit_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
