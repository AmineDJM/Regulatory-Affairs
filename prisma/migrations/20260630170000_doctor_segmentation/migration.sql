-- Segmentation à 5 niveaux des médecins/pharmaciens (influence, potentiel, affinité).
CREATE TYPE "SegmentLevel" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW');

ALTER TABLE "MedicalDoctor" ADD COLUMN "influence" "SegmentLevel" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "MedicalDoctor" ADD COLUMN "potential" "SegmentLevel" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "MedicalDoctor" ADD COLUMN "affinity"  "SegmentLevel" NOT NULL DEFAULT 'MEDIUM';

-- Reprise des données existantes vers la nouvelle échelle.
UPDATE "MedicalDoctor" SET "influence" = (CASE "influenceLevel"
  WHEN 'KEY_OPINION_LEADER' THEN 'VERY_HIGH'
  WHEN 'HIGH' THEN 'HIGH'
  WHEN 'LOW' THEN 'LOW'
  ELSE 'MEDIUM' END)::"SegmentLevel";

UPDATE "MedicalDoctor" SET "potential" = (CASE "prescriptionPotential"
  WHEN 'CRITICAL' THEN 'VERY_HIGH'
  WHEN 'HIGH' THEN 'HIGH'
  WHEN 'LOW' THEN 'LOW'
  ELSE 'MEDIUM' END)::"SegmentLevel";
