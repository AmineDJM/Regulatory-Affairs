-- NOTIFICATIONS — les index qui servent AUSSI le tri (§118.174).
--
-- Deux lectures reviennent à chaque page :
--   • « ses notifications non lues, les plus récentes d'abord, vingt au plus » (boîte de décision,
--     centre d'actions), et leur COMPTE (le gabarit, à chaque page) ;
--   • « toutes ses notifications, les plus récentes d'abord, cent au plus » (page Notifications).
-- Avec `("userId", "isRead")` seul, le planificateur n'a pas le tri : pour une personne qui a peu
-- de notifications (un compte neuf), il estime qu'il en trouvera vite et parcourt l'index des
-- dates À L'ENVERS en filtrant — c'est-à-dire toute la table. Mesuré sur la base de développement,
-- pour une personne sans notification : 4 757 069 lignes écartées par le filtre, 1,8 s, pour un
-- résultat vide — sur les DEUX lectures.
--
-- Avec la date dans l'index (égalité sur la personne, et sur « non lue » pour la première, puis le
-- tri), la lecture ne dépend plus de la taille de la table : 0,07 ms. Le premier index remplace
-- `("userId", "isRead")`, dont il est un préfixe : un index redondant ne coûte que des écritures.
--
-- IDEMPOTENTE. L'ordre (créer, puis retirer) garde toujours au moins un index sur ces colonnes.

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
  ON "Notification"("userId", "isRead", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt" DESC);

DROP INDEX IF EXISTS "Notification_userId_isRead_idx";
