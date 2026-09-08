-- ══════════════════════════════════════════════════════════════════════════════════════════
-- LONG HORIZON — une mission cesse d'être un DAG compilé d'avance.
--
-- Objectif durable → JALONS → sous-plans compilés PARESSEUSEMENT → frontière d'exécution →
-- replanification LOCALE d'une branche → vérification de l'issue.
--
-- Ce que ce SQL ajoute, et pourquoi chaque chose :
--
--   1. `MissionMilestone` — le jalon. Il porte son RÉSULTAT ATTENDU (ce qu'on doit pouvoir
--      constater), son statut, et SA version de plan. C'est ce qui permet de ne compiler que
--      le jalon courant : les suivants existent comme intention, pas comme étapes. Une mission
--      de trois semaines n'est plus trois cents étapes injectées dans un modèle.
--
--   2. `MissionStep.milestoneId` — NULLABLE, et c'est essentiel : les missions en cours et
--      tout le corpus existant continuent de tourner sans jalon. Le nouveau modèle s'ajoute,
--      il ne casse rien.
--
--   3. `MissionInput` — la FRAÎCHEUR. Une mission longue travaille sur des données qui
--      changent. Chaque entrée importante garde sa source, sa version, sa date de lecture et
--      son empreinte : avant d'agir sur une information du jour 1, le moteur peut demander
--      « est-elle encore vraie au jour 18 ? ». Sans cette table, une mission longue conclut
--      silencieusement sur une vérité périmée — le faux succès le plus difficile à voir.
--
--   4. La PAUSE porte sa date et son motif. Le statut PAUSED existait ; on ne savait ni depuis
--      quand, ni pourquoi, donc on ne pouvait ni le dire à l'écran ni le reprendre proprement.
--
-- SQL MANUEL IDEMPOTENT : rejouable sans effet.
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- 1. LE JALON.
CREATE TABLE IF NOT EXISTS "MissionMilestone" (
  "id"            TEXT NOT NULL,
  "missionId"     TEXT NOT NULL,
  -- Rang 1-indexé — l'ordre dans lequel la personne le lit.
  "ordre"         INTEGER NOT NULL,
  "titre"         TEXT NOT NULL,
  -- CE QU'ON DOIT POUVOIR CONSTATER quand ce jalon est atteint. C'est ce que le contrôle
  -- d'issue compare au réel — jamais « les étapes ont tourné ».
  "resultat"      TEXT NOT NULL,
  -- PENDING | ACTIVE | DONE | SKIPPED | BLOCKED | CANCELLED
  "statut"        TEXT NOT NULL DEFAULT 'PENDING',
  -- 0 = pas encore compilé en sous-plan. C'est la marque de la compilation PARESSEUSE.
  "planVersion"   INTEGER NOT NULL DEFAULT 0,
  -- Les ORDRES des jalons dont celui-ci dépend. Vide = il peut partir dès que la mission part.
  "dependsOn"     INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  -- Le budget anti-boucle est LOCAL au jalon (§4 du mandat) : pas de plafond global de replans.
  "replans"       INTEGER NOT NULL DEFAULT 0,
  -- Le dernier refus rencontré ici. Tant qu'il CHANGE, le planificateur répare et mérite un
  -- tour ; dès qu'il REVIENT identique, il est bloqué (§118.18).
  "dernierRefus"  TEXT,
  "compiledAt"    TIMESTAMP(3),
  "startedAt"     TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "notes"         JSONB NOT NULL DEFAULT '{}',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionMilestone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MissionMilestone_missionId_ordre_key" ON "MissionMilestone"("missionId", "ordre");
CREATE INDEX IF NOT EXISTS "MissionMilestone_missionId_statut_idx" ON "MissionMilestone"("missionId", "statut");
DO $$ BEGIN
  ALTER TABLE "MissionMilestone" ADD CONSTRAINT "MissionMilestone_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. L'ÉTAPE APPARTIENT À UN JALON — nullable : rien d'existant ne casse.
ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;
CREATE INDEX IF NOT EXISTS "MissionStep_milestoneId_idx" ON "MissionStep"("milestoneId");
DO $$ BEGIN
  ALTER TABLE "MissionStep" ADD CONSTRAINT "MissionStep_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "MissionMilestone"("id") ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. LA FRAÎCHEUR DES ENTRÉES.
CREATE TABLE IF NOT EXISTS "MissionInput" (
  "id"           TEXT NOT NULL,
  "missionId"    TEXT NOT NULL,
  "milestoneId"  TEXT,
  -- L'étape qui a lu cette donnée — pour savoir QUELLE branche devient obsolète.
  "stepKey"      TEXT,
  -- Le nom métier de la donnée : « forecast:NIVOLEX-2027 », « responsable:REG-2026-9011 ».
  "cle"          TEXT NOT NULL,
  -- D'où elle vient : « ERP:RegulatoryDossier:REG-2026-9011 », « humain:Khaled Mansouri ».
  "source"       TEXT NOT NULL,
  -- La version de la source quand elle en a une (updatedAt, n° de révision, ETag).
  "version"      TEXT,
  -- L'EMPREINTE de la valeur lue. C'est elle qui dit « ça a changé » sans stocker la donnée.
  "empreinte"    TEXT NOT NULL,
  -- Un digest lisible, borné — pour l'écran et le journal, jamais pour recalculer.
  "apercu"       TEXT,
  -- TROUVE | DEDUIT | CANDIDAT | INCONNU (§118.9) — seul TROUVE autorise à agir.
  "confiance"    TEXT NOT NULL DEFAULT 'TROUVE',
  "retrievedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- La date à laquelle la donnée est VRAIE, quand elle diffère de la date de lecture.
  "effectiveAt"  TIMESTAMP(3),
  -- Renseigné quand une lecture plus fraîche l'a remplacée : la branche qui en dépend est
  -- alors à réévaluer.
  "supersededAt" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionInput_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MissionInput_missionId_cle_idx" ON "MissionInput"("missionId", "cle");
CREATE INDEX IF NOT EXISTS "MissionInput_missionId_supersededAt_idx" ON "MissionInput"("missionId", "supersededAt");
CREATE INDEX IF NOT EXISTS "MissionInput_stepKey_idx" ON "MissionInput"("stepKey");
DO $$ BEGIN
  ALTER TABLE "MissionInput" ADD CONSTRAINT "MissionInput_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. LA PAUSE SAIT DEPUIS QUAND ET POURQUOI.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "pausedReason" TEXT;
-- L'état d'où la mission repart quand on la reprend — sans lui, « reprends » ne sait pas où.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "pausedFrom" TEXT;
