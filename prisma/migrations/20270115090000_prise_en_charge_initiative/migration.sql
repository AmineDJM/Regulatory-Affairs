-- QUI EST À L'ORIGINE DE LA DEMANDE DE PRISE EN CHARGE (Direction, 07/10) : « Mon initiative » ou « Initiative du médecin ».
-- Additive et idempotente : une colonne facultative, rien n'est réécrit.
ALTER TABLE "CongressInternational" ADD COLUMN IF NOT EXISTS "initiative" TEXT;
ALTER TABLE "CongressNational" ADD COLUMN IF NOT EXISTS "initiative" TEXT;
