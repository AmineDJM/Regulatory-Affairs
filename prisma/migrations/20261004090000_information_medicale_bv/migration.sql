-- LE BON DE VERSEMENT — l'étape qui précède la déclaration aux autorités.
--
-- On ne déclare pas un événement aux autorités sans avoir versé la taxe. Le PRIM demande le BV
-- (montant, note, pièces), le centre de paiement autorise, les Finances règlent, puis elles
-- REMETTENT le bon à son bureau. C'est cette remise qui débloque « Déclaration aux autorités ».
--
-- POURQUOI LA REMISE, ET NON LE PAIEMENT. « Payé » ne veut pas dire « le PRIM a le papier en
-- main », et c'est le papier qu'on dépose aux autorités. Déduire l'un de l'autre aurait débloqué
-- une déclaration que le pharmacien ne peut pas encore faire — et il aurait cherché longtemps
-- pourquoi son écran l'y autorisait.
--
-- La demande elle-même est une `PaymentRequest` ordinaire : elle emprunte le circuit commun
-- (centre de paiement → Finances) plutôt qu'un second circuit de paiement qui aurait divergé au
-- premier changement de règle.
--
-- Idempotent.

ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvRequestId"     TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvDeliveredAt"   TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvDeliveredById" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvDeliveryNote"  TEXT;

-- SANS BV : la porte de sortie, TRACÉE et MOTIVÉE. Sans elle, un dossier qui n'appelle aucun
-- versement resterait bloqué pour toujours — y compris tous ceux déjà en cours le jour où cette
-- étape est apparue. Sans le motif, elle deviendrait le contournement ordinaire.
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvSkippedAt"   TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvSkippedById" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "bvSkipReason"  TEXT;

CREATE INDEX IF NOT EXISTS "MedicalInfoDeclaration_bvRequestId_idx" ON "MedicalInfoDeclaration" ("bvRequestId");
