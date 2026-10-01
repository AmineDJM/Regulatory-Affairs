-- §118.162 — une demande supprimée emporte ses branches, dans UNE entrée de corbeille.
-- Idempotent : rejouable sans effet.
ALTER TABLE "DeletedRecord" ADD COLUMN IF NOT EXISTS "lot" JSONB;
