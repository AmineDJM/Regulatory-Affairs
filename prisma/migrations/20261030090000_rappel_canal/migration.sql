-- LE CANAL D'UN RAPPEL — « envoie-moi un mail dans 2 minutes » cessait d'être possible ici.
--
-- Un rappel n'avait pas de canal : il passait TOUJOURS par `notifyUser`, c'est-à-dire une ligne
-- de notification et un push. Adam répondait donc « je ne peux pas programmer un e-mail
-- différé » — vrai du mécanisme, faux de l'architecture : l'ordonnanceur sait viser la minute,
-- la boîte connectée sait envoyer, et le dirigeant a explicitement autorisé Adam à lui envoyer
-- un RAPPEL sans redemander (§118.39). Il ne manquait que la jonction.
--
-- NOTIFICATION (défaut, comportement historique) · EMAIL · LES_DEUX.
ALTER TABLE "AssistantReminder"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'NOTIFICATION';
