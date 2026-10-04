-- Luna conseille où ranger une pièce déposée sur une demande Ad & Pro (consultatif, aucune écriture).
-- Allumé par défaut : la bascule du Centre de contrôle IA le coupe. Idempotente.
ALTER TABLE "AiSetting" ADD COLUMN IF NOT EXISTS "conseilPiecesEnabled" BOOLEAN NOT NULL DEFAULT true;
