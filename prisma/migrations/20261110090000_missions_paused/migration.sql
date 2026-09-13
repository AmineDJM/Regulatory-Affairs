-- SUSPENSION GLOBALE DES MISSIONS D'ADAM (§118.132).
--
-- Le dirigeant recevait « Bloqué — Diagnostic — … » sans arrêt : des missions de banc laissées
-- vivantes en production se replanifiaient à chaque battement et notifiaient à chaque version
-- de plan, et il n'existait AUCUN interrupteur du moteur — seulement une variable
-- d'environnement (`MISSIONS_SWEEP=off`) qu'un écran ne peut pas poser.
--
-- Un booléen sur `AppSetting`, à côté de l'arrêt d'urgence des actions externes de l'IA : même
-- famille (un garde-fou global, réglé par la direction), même ligne `global`. La date et
-- l'auteur sont portés parce qu'un état sans contenu est un mot (§118.45) : l'écran doit dire
-- « suspendues depuis le … par … ».
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "missionsPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "missionsPausedAt" TIMESTAMP(3);
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "missionsPausedById" TEXT;
