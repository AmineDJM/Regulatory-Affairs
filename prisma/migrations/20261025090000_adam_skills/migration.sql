-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LES MICRO-OUTILS D'ADAM (mandat 5 §36) — du code passé par la porte de qualité, exposé comme
-- outil TEMPORAIRE à son créateur, promu par une PERSONNE ou jeté. Idempotent : rejouable sans
-- effet sur une base qui l'a déjà.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "AdamSkill" (
  "id"           TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "ownerId"      TEXT NOT NULL,
  "scope"        TEXT NOT NULL DEFAULT 'PERSON',
  "companyId"    TEXT,
  "departmentId" TEXT,
  "title"        TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "domain"       TEXT NOT NULL DEFAULT 'DATA',
  "langage"      TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "inputSchema"  JSONB NOT NULL,
  "exemple"      JSONB,
  "attentes"     JSONB,
  "schemaSortie" JSONB,
  "status"       TEXT NOT NULL DEFAULT 'TEMP',
  "version"      INTEGER NOT NULL DEFAULT 1,
  "usageCount"   INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"   TIMESTAMP(3),
  "expiresAt"    TIMESTAMP(3),
  "promotedById" TEXT,
  "promotedAt"   TIMESTAMP(3),
  "provenance"   JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdamSkill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdamSkill_ownerId_slug_key" ON "AdamSkill"("ownerId", "slug");
CREATE INDEX IF NOT EXISTS "AdamSkill_status_scope_idx" ON "AdamSkill"("status", "scope");
CREATE INDEX IF NOT EXISTS "AdamSkill_companyId_status_idx" ON "AdamSkill"("companyId", "status");
CREATE INDEX IF NOT EXISTS "AdamSkill_departmentId_status_idx" ON "AdamSkill"("departmentId", "status");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamSkill_ownerId_fkey') THEN
    ALTER TABLE "AdamSkill" ADD CONSTRAINT "AdamSkill_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
