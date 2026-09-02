-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- INFORMATION MÉDICALE — DEUX CIRCUITS, ET LE BON DE VERSEMENT DEVIENT UN PAR MATÉRIEL
--
-- ── CE QU'ON CORRIGE ────────────────────────────────────────────────────────────────────────
--
-- 1. Le module traitait tout de la même façon : quoi qu'il arrive au pharmacien responsable, il
--    fallait un BON DE VERSEMENT avant de pouvoir déclarer quoi que ce soit. Or cette taxe ne
--    concerne QUE le matériel promotionnel. Une prise en charge, un sponsoring, un événement
--    n'appellent aucun versement : ils appellent une DÉCISION — faut-il les déclarer au ministère
--    de l'Industrie pharmaceutique ? Chaque dossier d'événement sortait donc par la porte « ce
--    dossier n'appelle aucun versement », motif à l'appui : un contournement obligatoire n'est
--    plus une porte de sortie, c'est le chemin normal mal nommé.
--
-- 2. Il n'y avait qu'UN bon de versement par dossier. Un dossier de matériel en porte plusieurs —
--    un présentoir, des affiches, une vidéo — chacun sa taxe, chacun sa quittance. On additionnait
--    les montants pour n'en demander qu'un, et ce qui n'entrait pas dans la case se réglait hors
--    ERP.
--
-- ── CE QUE CETTE MIGRATION FAIT ─────────────────────────────────────────────────────────────
--
--   • ajoute la DÉCISION de déclarer (circuit événement) ;
--   • ajoute la nature CHOISIE par le pharmacien quand c'est lui qui ouvre un dossier ;
--   • crée `MedicalInfoSlip` — un bon de versement par matériel ;
--   • REPREND l'existant : le bon unique de chaque dossier devient un matériel, et les dossiers
--     d'événement déjà instruits sont réputés décidés — sans quoi ils repartiraient à zéro sur
--     une question tranchée il y a des mois, parfois après un dépôt déjà fait.
--
-- Idempotente : chaque bloc se rejoue sans effet.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA DÉCISION DE DÉCLARER, et ce que le PRIM ouvre lui-même ─────────────────────────────
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareIntent"        TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareValidationId"  TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareNote"          TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareRequestedAt"   TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareRequestedById" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declareGrantedAt"     TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "declarationKind"      TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "createdById"          TEXT;

-- ── 2. UN BON DE VERSEMENT PAR MATÉRIEL ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MedicalInfoSlip" (
  "id"            TEXT NOT NULL,
  "declarationId" TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "amount"        DECIMAL(14,2),
  "note"          TEXT,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "requestId"     TEXT,
  "deliveredAt"   TIMESTAMP(3),
  "deliveredById" TEXT,
  "deliveryNote"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalInfoSlip_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalInfoSlip_declarationId_fkey') THEN
    ALTER TABLE "MedicalInfoSlip"
      ADD CONSTRAINT "MedicalInfoSlip_declarationId_fkey"
      FOREIGN KEY ("declarationId") REFERENCES "MedicalInfoDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MedicalInfoSlip_declarationId_idx" ON "MedicalInfoSlip"("declarationId");
CREATE INDEX IF NOT EXISTS "MedicalInfoSlip_requestId_idx"     ON "MedicalInfoSlip"("requestId");

-- ── 3. REPRISE — le bon unique de chaque dossier devient SON PREMIER MATÉRIEL ─────────────────
--
-- On ne reprend que les dossiers qui ont réellement engagé un versement (une demande de paiement,
-- ou une quittance déjà remise). Les autres n'ont rien à reprendre : ils n'avaient qu'une
-- intention. L'identifiant est DÉRIVÉ de celui de la déclaration (`mislip_` + id), ce qui rend le
-- rejeu sans effet et la provenance lisible dans le journal.
INSERT INTO "MedicalInfoSlip" ("id", "declarationId", "label", "amount", "note", "position", "requestId", "deliveredAt", "deliveredById", "deliveryNote", "createdAt", "updatedAt")
SELECT
  'mislip_' || d."id",
  d."id",
  'Bon de versement du dossier',
  d."bvAmount",
  d."bvNote",
  0,
  d."bvRequestId",
  d."bvDeliveredAt",
  d."bvDeliveredById",
  d."bvDeliveryNote",
  COALESCE(d."bvRequestedAt", d."createdAt"),
  CURRENT_TIMESTAMP
FROM "MedicalInfoDeclaration" d
WHERE (d."bvRequestId" IS NOT NULL OR d."bvDeliveredAt" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;

-- ── 4. REPRISE — les dossiers d'ÉVÉNEMENT déjà instruits sont réputés décidés ─────────────────
--
-- Un dossier dont le pharmacien a déjà tranché la question du versement (bon remis, ou dossier
-- déclaré sans versement) a fait son travail sous les règles d'alors. Le renvoyer à « décision à
-- demander » lui ferait refaire signer une question tranchée il y a des mois — parfois sur un
-- dossier déjà déposé au ministère. L'intention reprise est celle que les faits montrent : une
-- référence d'autorité présente veut dire « déclaré », son absence « sans déclaration ».
UPDATE "MedicalInfoDeclaration"
SET "declareGrantedAt" = COALESCE("bvDeliveredAt", "bvSkippedAt", "pharmacistValidatedAt", "createdAt"),
    "declareIntent"    = CASE WHEN COALESCE(NULLIF(TRIM("authorityRef"), ''), NULL) IS NOT NULL THEN 'DECLARE' ELSE 'SKIP' END
WHERE "declareGrantedAt" IS NULL
  AND "sourceType" <> 'PROMO_MATERIAL'
  AND ("bvDeliveredAt" IS NOT NULL OR "bvSkippedAt" IS NOT NULL OR "status" IN ('AWAITING_DIRECTION', 'VALIDATED'));
