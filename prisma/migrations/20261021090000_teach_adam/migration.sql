-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- TEACH ADAM — la couche de règles enseignées à Adam (§119).
--
-- Une table, versionnée PAR LIGNES : modifier une règle crée une nouvelle ligne (`version + 1`,
-- `supersedesId` → l'ancienne, qui passe en SUPERSEDED) ; supprimer met en DELETED. Rien n'est
-- effacé : toute règle passée se relit. Une règle porte son périmètre (personne / département /
-- société), son domaine, sa priorité, ses dates d'effet, sa provenance et le nom de qui l'a dite.
--
-- Idempotent : rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "AdamRule" (
  "id"            TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "scope"         TEXT NOT NULL,
  "ownerId"       TEXT NOT NULL,
  "subjectUserId" TEXT,
  "companyId"     TEXT,
  "departmentId"  TEXT,
  "domain"        TEXT NOT NULL DEFAULT 'general',
  "title"         TEXT NOT NULL,
  "statement"     TEXT NOT NULL,
  "params"        JSONB,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"   TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "version"       INTEGER NOT NULL DEFAULT 1,
  "supersedesId"  TEXT,
  "provenance"    JSONB,
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdamRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdamRule_supersedesId_key" ON "AdamRule" ("supersedesId");
CREATE INDEX IF NOT EXISTS "AdamRule_subjectUserId_status_idx" ON "AdamRule" ("subjectUserId", "status");
CREATE INDEX IF NOT EXISTS "AdamRule_companyId_status_idx" ON "AdamRule" ("companyId", "status");
CREATE INDEX IF NOT EXISTS "AdamRule_departmentId_status_idx" ON "AdamRule" ("departmentId", "status");
CREATE INDEX IF NOT EXISTS "AdamRule_ownerId_status_idx" ON "AdamRule" ("ownerId", "status");
CREATE INDEX IF NOT EXISTS "AdamRule_kind_domain_idx" ON "AdamRule" ("kind", "domain");
CREATE INDEX IF NOT EXISTS "AdamRule_status_effectiveFrom_idx" ON "AdamRule" ("status", "effectiveFrom");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamRule_ownerId_fkey') THEN
    ALTER TABLE "AdamRule" ADD CONSTRAINT "AdamRule_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamRule_subjectUserId_fkey') THEN
    ALTER TABLE "AdamRule" ADD CONSTRAINT "AdamRule_subjectUserId_fkey"
      FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamRule_companyId_fkey') THEN
    ALTER TABLE "AdamRule" ADD CONSTRAINT "AdamRule_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamRule_departmentId_fkey') THEN
    ALTER TABLE "AdamRule" ADD CONSTRAINT "AdamRule_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamRule_supersedesId_fkey') THEN
    ALTER TABLE "AdamRule" ADD CONSTRAINT "AdamRule_supersedesId_fkey"
      FOREIGN KEY ("supersedesId") REFERENCES "AdamRule"("id") ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;
