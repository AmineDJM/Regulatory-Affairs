-- Seuil de montant → franchissement automatique d'étape (anti-bureaucratie configurable).
-- Ajoute une colonne nullable sur WorkflowStep : si le montant de travail de l'instance est
-- inférieur ou égal à ce seuil (DZD), l'étape est franchie sans action humaine (tracée).
-- Idempotent : IF NOT EXISTS.
ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "autoSkipMaxAmount" DECIMAL(14, 2);
