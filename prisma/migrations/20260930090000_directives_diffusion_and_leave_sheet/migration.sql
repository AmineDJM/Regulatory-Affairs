-- DIRECTIVES : diffusion large (tous / plusieurs / entité), publication validée par la direction
-- générale, pop-up et relance — et CONGÉS : le numéro où joindre la personne absente.
--
-- Idempotent : chaque type, colonne et index n'est créé que s'il manque. Rejouable sans dommage.

-- ── Types ────────────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DirectiveAudience" AS ENUM ('USERS', 'ROLE', 'COMPANY', 'ALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DirectivePublication" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Directive : audience ─────────────────────────────────────────────────────────────────────
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "audience" "DirectiveAudience" NOT NULL DEFAULT 'USERS';
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "targetUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- ── Directive : publication ──────────────────────────────────────────────────────────────────
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "publication" "DirectivePublication" NOT NULL DEFAULT 'PENDING_APPROVAL';
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "popup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "sendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Directive" ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3);

-- REPRISE DE L'EXISTANT — les directives déjà émises l'ont été sous l'ancien régime : elles sont
-- publiées (leurs destinataires les ont reçues), et leur portée se déduit de ce qui est rempli.
-- Sans cette reprise, une note lue il y a six mois réapparaîtrait « en attente de validation ».
UPDATE "Directive"
   SET "publication" = 'PUBLISHED',
       "publishedAt" = COALESCE("publishedAt", "createdAt"),
       "sendCount"   = GREATEST("sendCount", 1),
       "lastSentAt"  = COALESCE("lastSentAt", "createdAt")
 WHERE "publishedAt" IS NULL AND "publication" = 'PENDING_APPROVAL';

UPDATE "Directive" SET "audience" = 'ROLE' WHERE "targetRole" IS NOT NULL AND "targetUserId" IS NULL;
UPDATE "Directive"
   SET "targetUserIds" = ARRAY["targetUserId"]
 WHERE "targetUserId" IS NOT NULL AND cardinality("targetUserIds") = 0;

-- ── Clés étrangères (créées seulement si absentes) ───────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "Directive" ADD CONSTRAINT "Directive_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Directive" ADD CONSTRAINT "Directive_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Directive_publication_idx" ON "Directive"("publication");
CREATE INDEX IF NOT EXISTS "Directive_companyId_idx" ON "Directive"("companyId");

-- ── Accès du module, réglés par le Super Admin ───────────────────────────────────────────────
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "directiveReaderRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "directiveReaderUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "directiveIssuerRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "directiveIssuerUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ── Congé : le numéro où joindre la personne pendant son absence ─────────────────────────────
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "phone" TEXT;
