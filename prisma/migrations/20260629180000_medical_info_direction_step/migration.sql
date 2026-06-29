-- Étape Direction intercalée entre la validation du pharmacien (PRIM) et l'ordre de dépense.
-- Le pharmacien valide → la déclaration part à la Direction (AWAITING_DIRECTION), puis la
-- Direction valide pour le comptable (VALIDATED → ordre de dépense émis).
ALTER TYPE "MedicalInfoStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DIRECTION' BEFORE 'VALIDATED';

ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "pharmacistValidatedAt" TIMESTAMP(3);
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "pharmacistValidatedById" TEXT;
