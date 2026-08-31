-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE BON DE VERSEMENT SE FAIT EN DEUX TEMPS : on l'ACCORDE, puis on paie la QUITTANCE.
--
-- Jusqu'ici, le pharmacien responsable déposait directement une demande de PAIEMENT, qui partait
-- au centre de paiement. Le principe même du versement n'était donc jamais discuté : le centre
-- se retrouvait à autoriser un décaissement dont personne, en amont, n'avait dit qu'il était dû.
-- Refuser à ce stade coûte cher — le dossier est déjà instruit, et le refus se lit comme un
-- désaveu comptable alors qu'il porte sur le fond.
--
-- On insère donc la marche qui manquait : la demande de bon est VALIDÉE par le N+1, le chef de
-- produit et le centre de validations (Directeur Général, à défaut Super Admin) AVANT qu'aucun
-- argent ne soit engagé. La demande de paiement qui suit ne porte plus que la QUITTANCE.
--
-- Idempotent : rejouable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- 1. La validation du BON, et ce que le PRIM annonce en le demandant.
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvValidationId"  TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvAmount"        DECIMAL(14,2);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvNote"          TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvRequestedAt"   TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvRequestedById" TEXT;

-- 2. RETROUVER LE FIL DES DOSSIERS DÉJÀ EN COURS.
--
-- Ceux qui ont déjà une demande de paiement l'ont obtenue sans la validation qui n'existait pas.
-- Les renvoyer à la case départ ferait recommencer un circuit déjà instruit, et invaliderait des
-- autorisations réellement données. On note donc la date de la demande existante comme date de
-- demande du bon : le dossier reprend au bon endroit, et son historique reste lisible.
UPDATE "MedicalInfoDeclaration" d
SET "bvRequestedAt" = p."createdAt",
    "bvRequestedById" = p."requesterId",
    "bvAmount" = p."amount"
FROM "PaymentRequest" p
WHERE d."bvRequestId" = p."id"
  AND d."bvRequestedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "MedicalInfoDeclaration_bvValidationId_idx"
  ON "MedicalInfoDeclaration" ("bvValidationId");
