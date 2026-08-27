-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- L'ÉVENTAIL ET L'IDEMPOTENCE SONT DES PROPRIÉTÉS DE L'ÉTAPE, PAS DE SON PAYLOAD.
--
-- La première écriture les rangeait sous des clés réservées dans `input` (`__forEach`,
-- `__idempotent`). C'était une erreur pour deux raisons concrètes :
--
--   1. `input` est ce que l'humain APPROUVE et ce que la capacité REÇOIT. Y glisser des
--      directives de moteur fait que le payload stocké n'est plus le payload approuvé.
--   2. Une capacité a parfaitement le droit d'avoir un champ nommé `__idempotent`. Le jour où
--      cela arrive, la collision est silencieuse et le mauvais chemin est pris.
--
-- Deux colonnes règlent les deux problèmes.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "forEach" JSONB;
ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "needsIdempotencyKey" BOOLEAN NOT NULL DEFAULT false;

-- L'étape MODÈLE d'un éventail attend ses filles ; les filles portent la clé du modèle suivie
-- d'un `#`. Cet index sert la fermeture du fan-in, qui est le chemin chaud du moteur.
CREATE INDEX IF NOT EXISTS "MissionStep_mission_workstream_idx" ON "MissionStep"("missionId", "workstream");
