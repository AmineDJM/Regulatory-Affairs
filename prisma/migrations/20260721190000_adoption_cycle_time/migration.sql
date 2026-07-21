-- Score d'adoption : nouvelle dimension « temps de cycle » — mesure la VITESSE à traiter les
-- éléments qui incombent à l'utilisateur (validations décidées, tâches terminées), pas le volume
-- de clics. Plus le délai médian arrivée→traitement est court, meilleur le sous-score.
-- Poids + cible réglables par le Super Admin. Colonnes avec défaut ⇒ lignes existantes alimentées.
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "wCycle" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtCycleHours" INTEGER NOT NULL DEFAULT 48;
