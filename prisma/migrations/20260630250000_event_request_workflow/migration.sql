-- Workflow de prise en charge des Événements (identique aux congrès) :
-- soumission → National Sales (préliminaire + chef de produit) → analyse chef de
-- produit → Direction (validation définitive + budget) → information médicale (PRIM).
-- Champs nullables : un événement sans demande de financement garde requestStatus NULL.
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "requesterId"          TEXT,
  ADD COLUMN IF NOT EXISTS "requestStatus"        "CongressRequestStatus",
  ADD COLUMN IF NOT EXISTS "productManagerId"     TEXT,
  ADD COLUMN IF NOT EXISTS "productManagerBudget" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "productManagerNotes"  TEXT,
  ADD COLUMN IF NOT EXISTS "preliminaryById"      TEXT,
  ADD COLUMN IF NOT EXISTS "preliminaryAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "preliminaryNote"      TEXT,
  ADD COLUMN IF NOT EXISTS "finalById"            TEXT,
  ADD COLUMN IF NOT EXISTS "finalAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalNote"            TEXT,
  ADD COLUMN IF NOT EXISTS "finalAmount"          DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "rejectionReason"      TEXT,
  ADD COLUMN IF NOT EXISTS "expenseOrderId"       TEXT;

CREATE INDEX IF NOT EXISTS "Event_requestStatus_idx" ON "Event"("requestStatus");
