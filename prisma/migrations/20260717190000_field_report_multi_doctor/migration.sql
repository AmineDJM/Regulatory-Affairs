-- Rapports terrain simplifiés : plusieurs médecins possibles par compte rendu.
ALTER TABLE "FieldReport" ADD COLUMN IF NOT EXISTS "doctorIds" TEXT[] NOT NULL DEFAULT '{}'::text[];
