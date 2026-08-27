-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE RUNTIME DEVIENT RÉEL — la spécification d'une étape, la carte du plan, et les artefacts.
--
-- 1. `MissionStep.spec` — CE QUE L'ÉTAPE ATTEND, à côté de `input` et jamais dedans.
--    `input` est ce que l'humain approuve et ce que la capacité reçoit. Y glisser le schéma de
--    sortie d'un worker ou sa condition d'achèvement rendrait le payload stocké différent du
--    payload approuvé — la faute exacte que `needsIdempotencyKey` a déjà fait corriger.
--
-- 2. `Mission.planMeta` — les axes, les livrables attendus, la stratégie d'accord et le critère
--    arithmétique de fin. Quatre informations produites par le planner, lues par le contrôle
--    qualité et par le juge. Une colonne plutôt que quatre : elles naissent et meurent ensemble,
--    et aucune n'est interrogée seule.
--
-- 3. `MissionArtifact` — le FICHIER produit, avec la preuve qu'il a été contrôlé.
--    `AssistantArtifact` existe déjà et n'est pas dupliqué : il porte la spec d'un livrable de
--    conversation, sans mission, sans étape, sans verdict de contrôle. Ce qu'on ajoute ici est
--    exactement ce qui manque pour qu'un artefact serve de PREUVE d'achèvement (§22).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "spec" JSONB;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "planMeta" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "MissionArtifact" (
  "id"          TEXT NOT NULL,
  "missionId"   TEXT NOT NULL,
  "stepId"      TEXT,
  "key"         TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "format"      TEXT NOT NULL,
  "fileName"    TEXT NOT NULL,
  "byteSize"    INTEGER NOT NULL DEFAULT 0,
  "sha256"      TEXT,
  "driveNodeId" TEXT,
  "spec"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- PENDING | BUILT | VERIFIED | REJECTED — un artefact non VÉRIFIÉ ne prouve rien.
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "qaReport"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionArtifact_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "MissionArtifact" ADD CONSTRAINT "MissionArtifact_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MissionArtifact" ADD CONSTRAINT "MissionArtifact_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "MissionStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UNE CLÉ D'ARTEFACT PAR MISSION — la ré-exécution d'une étape ARTIFACT remplace le fichier au
-- lieu d'en empiler un second. Sans cela, trois reprises produiraient trois « Analyse PCH.xlsx »
-- et personne ne saurait lequel fait foi.
CREATE UNIQUE INDEX IF NOT EXISTS "MissionArtifact_missionId_key_key" ON "MissionArtifact"("missionId", "key");
CREATE INDEX IF NOT EXISTS "MissionArtifact_missionId_status_idx" ON "MissionArtifact"("missionId", "status");
