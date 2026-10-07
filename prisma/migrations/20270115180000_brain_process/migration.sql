-- ADVENTUM BRAIN + PROCESS INTELLIGENCE (refonte 07/10).
--
-- 1. Des risques qui ont une vie (`BrainRisk`) : la clé stable du détecteur relie le calcul d'une heure à
--    celui de l'heure suivante ; état NOUVEAU → PRIS_EN_CHARGE → RESOLU, ou IGNORE jusqu'à une date.
-- 2. Le briefing du matin, gardé (`BrainBriefing`, un par jour) et les questions posées (`BrainQuestion`).
-- 3. Le délai cible d'une étape de circuit (`ProcessStepSla`) — au-delà, Brain le signale.
-- 4. Les seuils des nouveaux détecteurs (`RiskSetting`).
--
-- Idempotent : chaque table, colonne et index n'est créé que s'il manque. Aucune clé étrangère.

ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "recruitmentUnpublishedDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "fieldCoverageMinPct" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "adproCdMaxPct" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "bcUnsignedDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "tourPlanLeadDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "aiCostDriftPct" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "RiskSetting" ADD COLUMN IF NOT EXISTS "processStuckDays" INTEGER NOT NULL DEFAULT 14;

CREATE TABLE IF NOT EXISTS "BrainRisk" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "object" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "href" TEXT,
  "detail" JSONB NOT NULL,
  "recommendation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOUVEAU',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snoozedUntil" TIMESTAMP(3),
  "assigneeId" TEXT,
  "taskId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedAuto" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "history" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrainRisk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BrainRisk_key_key" ON "BrainRisk"("key");
CREATE INDEX IF NOT EXISTS "BrainRisk_status_level_idx" ON "BrainRisk"("status", "level");
CREATE INDEX IF NOT EXISTS "BrainRisk_lastSeenAt_idx" ON "BrainRisk"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "BrainBriefing" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "risks" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'regles',
  "model" TEXT,
  "costUsd" DECIMAL(12,6),
  "error" TEXT,
  "generatedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrainBriefing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BrainBriefing_day_key" ON "BrainBriefing"("day");
CREATE INDEX IF NOT EXISTS "BrainBriefing_generatedAt_idx" ON "BrainBriefing"("generatedAt");

CREATE TABLE IF NOT EXISTS "BrainQuestion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "proposals" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrainQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BrainQuestion_userId_createdAt_idx" ON "BrainQuestion"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "ProcessStepSla" (
  "id" TEXT NOT NULL,
  "circuit" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "stepLabel" TEXT NOT NULL,
  "targetDays" INTEGER NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessStepSla_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessStepSla_circuit_stepKey_key" ON "ProcessStepSla"("circuit", "stepKey");
