-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE REGISTRE D'ÉVÉNEMENTS MÉTIER + LA PREUVE D'UNE TÂCHE
--
-- Idempotente et ADDITIVE : aucune colonne supprimée, aucune donnée touchée. Une base déjà
-- migrée la traverse sans effet ; une base neuve obtient la même forme.
--
-- Origine : une tâche « Déposer le contrat de la consultante dans Ad&Pro > Consulting » est
-- restée « à faire » alors que le contrat AVAIT été déposé. Adam l'a donc annoncée en retard.
-- Voir src/lib/tasks/evidence.ts.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Le registre transverse ───────────────────────────

CREATE TABLE IF NOT EXISTS "BusinessEvent" (
  "id"            TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "occurredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId"       TEXT,
  "sourceDomain"  TEXT NOT NULL,
  "entityType"    "EntityType",
  "entityId"      TEXT,
  "relatedRefs"   TEXT[] DEFAULT ARRAY[]::TEXT[],
  "payload"       JSONB,
  "correlationId" TEXT,
  "missionId"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessEvent_type_occurredAt_idx"    ON "BusinessEvent"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "BusinessEvent_entityType_entityId_idx" ON "BusinessEvent"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "BusinessEvent_correlationId_idx"       ON "BusinessEvent"("correlationId");
CREATE INDEX IF NOT EXISTS "BusinessEvent_occurredAt_idx"          ON "BusinessEvent"("occurredAt");

-- La clé étrangère est posée à part : `ADD CONSTRAINT IF NOT EXISTS` n'existe pas en Postgres,
-- d'où le bloc conditionnel. `ON DELETE SET NULL` : la suppression d'un compte ne doit pas
-- effacer l'HISTOIRE — un fait survenu reste un fait, même sans son auteur.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessEvent_actorId_fkey'
  ) THEN
    ALTER TABLE "BusinessEvent"
      ADD CONSTRAINT "BusinessEvent_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────── Ce qu'une tâche attend, et sa preuve ───────────────────────────

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "expectedEvent"      TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "evidenceEntityType" "EntityType";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "evidenceEntityId"   TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "evidenceAt"         TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "evidenceActorId"    TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "evidenceNote"       TEXT;

-- Les tâches OUVERTES qui portent une preuve : c'est la seule lecture chaude de ces colonnes
-- (« y a-t-il des choses en retard ? »), et elle doit rester instantanée.
CREATE INDEX IF NOT EXISTS "Task_status_evidenceAt_idx" ON "Task"("status", "evidenceAt");
