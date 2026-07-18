-- Organigramme (carte) : position mémorisée par nœud (glisser-déposer). Null = placement auto.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "orgX" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "orgY" DOUBLE PRECISION;
