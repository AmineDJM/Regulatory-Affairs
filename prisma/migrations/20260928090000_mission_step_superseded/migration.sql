-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- UNE ÉTAPE QUE LE PLAN COURANT NE PORTE PLUS N'EST PLUS UNE OBLIGATION.
--
-- LE DÉFAUT MESURÉ. Sur un run Render du 28/08, le scénario RECOURS a vu son étape
-- « lecture-drive-contracts » échouer sous le plan v1 ; le plan v2 a contourné le problème et
-- exécuté avec succès neuf autres étapes ; la mission est malgré tout revenue BLOCKED, puis a
-- replanifié deux fois de plus, et le juge d'objectif n'a JAMAIS été atteint. La cause : l'étape
-- en échec du plan v1 restait en base avec ses tentatives épuisées, et `deduireEtat` la comptait
-- comme un échec courant. Une erreur d'un plan abandonné bloquait tous les plans suivants.
--
-- POURQUOI UNE COLONNE ET NON UN STATUT. Basculer l'étape en `SKIPPED` effacerait le fait
-- qu'elle a ÉCHOUÉ — or c'est une pièce du dossier : le juge et l'écran doivent pouvoir dire
-- « ceci a été tenté sous le plan 1 et n'a pas abouti ». On garde donc `status = FAILED`, son
-- `error` et son `errorKind`, et l'on marque à part le fait que le plan courant a tourné autour.
--
-- Idempotent : `IF NOT EXISTS` — la migration peut être rejouée sans dommage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "supersededAt" TIMESTAMP(3);

-- L'index sert la seule question qu'on pose à cette colonne : « quelles étapes de cette mission
-- comptent encore ? ». Sans lui, chaque tour de moteur balaierait toutes les étapes de toutes
-- les versions d'une mission de trois cents pas.
CREATE INDEX IF NOT EXISTS "MissionStep_missionId_supersededAt_idx"
  ON "MissionStep" ("missionId", "supersededAt");
