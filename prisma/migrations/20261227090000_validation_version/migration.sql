-- La version d'une demande de validation (audit 360°, R08) : 1 au dépôt, +1 à chaque resoumission
-- après un renvoi pour correction. Idempotente.
ALTER TABLE "ValidationRequest" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
