-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LA RÉCURRENCE D'UNE DEMANDE D'ÉTAT DE STOCK (#119).
--
-- IDEMPOTENTE, comme toute migration de ce dépôt : `IF NOT EXISTS` partout. Une migration qui
-- ne se rejoue pas oblige à savoir si elle est déjà passée, ce que personne ne sait avec
-- certitude sur trois environnements.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "StockRequestRecurrence" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "assigneeId"  TEXT NOT NULL,
  "note"        TEXT,
  "recurrence"  TEXT NOT NULL,
  "hourLocal"   INTEGER NOT NULL DEFAULT 8,
  "dayOfWeek"   INTEGER,
  "dayOfMonth"  INTEGER,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt"   TIMESTAMP(3) NOT NULL,
  "lastRunAt"   TIMESTAMP(3),
  "claimedAt"   TIMESTAMP(3),
  "runCount"    INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockRequestRecurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockRequestRecurrenceHospital" (
  "recurrenceId" TEXT NOT NULL,
  "annexId"      TEXT NOT NULL,
  CONSTRAINT "StockRequestRecurrenceHospital_pkey" PRIMARY KEY ("recurrenceId", "annexId")
);

-- LES INDEX : la requête du battement est « ACTIVE et dues », donc l'index porte les deux.
CREATE INDEX IF NOT EXISTS "StockRequestRecurrence_status_nextRunAt_idx"
  ON "StockRequestRecurrence" ("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "StockRequestRecurrence_assigneeId_idx"
  ON "StockRequestRecurrence" ("assigneeId");
CREATE INDEX IF NOT EXISTS "StockRequestRecurrenceHospital_annexId_idx"
  ON "StockRequestRecurrenceHospital" ("annexId");

-- LES CLÉS ÉTRANGÈRES, chacune avec la conduite que le schéma justifie :
--   · l'assigné en CASCADE — une réquisition adressée à un compte supprimé ne doit pas tourner ;
--   · l'auteur en SET NULL — l'historique reste lisible quand la personne part, et la relecture
--     d'autorité refusera alors de déclencher (une récurrence sans auteur n'a plus d'autorité) ;
--   · les hôpitaux en CASCADE des deux côtés — un hôpital supprimé sort de la récurrence au
--     lieu d'y laisser une référence morte.
DO $$ BEGIN
  ALTER TABLE "StockRequestRecurrence"
    ADD CONSTRAINT "StockRequestRecurrence_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockRequestRecurrence"
    ADD CONSTRAINT "StockRequestRecurrence_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockRequestRecurrenceHospital"
    ADD CONSTRAINT "StockRequestRecurrenceHospital_recurrenceId_fkey"
    FOREIGN KEY ("recurrenceId") REFERENCES "StockRequestRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockRequestRecurrenceHospital"
    ADD CONSTRAINT "StockRequestRecurrenceHospital_annexId_fkey"
    FOREIGN KEY ("annexId") REFERENCES "StockAnnex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
