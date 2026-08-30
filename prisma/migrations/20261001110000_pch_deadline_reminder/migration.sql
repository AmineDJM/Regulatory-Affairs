-- Market 360° — rappels d'échéance de dépôt : le verrou anti-spam du balayage quotidien.
-- Idempotente et additive : rejouable sans risque, aucune donnée touchée.
ALTER TABLE "PchTender" ADD COLUMN IF NOT EXISTS "deadlineRemindedAt" TIMESTAMP(3);
