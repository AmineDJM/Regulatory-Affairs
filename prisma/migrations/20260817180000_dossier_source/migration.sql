-- DOSSIER né d'une implication de tierce personne : on retient l'objet d'origine (la demande
-- Ad & Pro) pour faire remonter la conversation À L'ENDROIT de la demande. Idempotent.
ALTER TABLE "Dossier" ADD COLUMN IF NOT EXISTS "sourceType" "EntityType";
ALTER TABLE "Dossier" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
CREATE INDEX IF NOT EXISTS "Dossier_sourceType_sourceId_idx" ON "Dossier"("sourceType", "sourceId");
