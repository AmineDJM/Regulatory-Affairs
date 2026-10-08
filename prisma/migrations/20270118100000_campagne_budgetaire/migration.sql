-- CAMPAGNE BUDGÉTAIRE (« Budgets 2027 », Direction 10/2026 — maquette validée) et ORGANIGRAMME SOURCE UNIQUE.
--   1. Les tables de la campagne : campagne, proposition par pôle, versions, lignes, fil d'échanges, avis des valideurs.
--   2. Le rattrapage de l'organigramme : le libellé « département » de la fiche salarié et le département du compte
--      utilisateur s'alignent sur le département STRUCTURÉ de la fiche (la seule source).
--
-- Idempotente : rejouée, elle ne change plus rien.

-- 1. LA CAMPAGNE ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BudgetCampaign" (
  "id"                    TEXT NOT NULL,
  "year"                  INTEGER NOT NULL,
  "companyId"             TEXT,
  "title"                 TEXT NOT NULL,
  "opensAt"               TIMESTAMP(3) NOT NULL,
  "submitDeadline"        TIMESTAMP(3) NOT NULL,
  "validationDeadline"    TIMESTAMP(3) NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'DRAFT',
  "cadrageTotal"          DECIMAL(16,2),
  "validatorMode"         TEXT NOT NULL DEFAULT 'COMITE',
  "validatorIds"          TEXT[] DEFAULT ARRAY[]::TEXT[],
  "validatorRule"         TEXT NOT NULL DEFAULT 'ALL',
  "allowRectificatif"     BOOLEAN NOT NULL DEFAULT false,
  "seuilJustificationPct" DECIMAL(6,2) NOT NULL DEFAULT 5,
  "createdById"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BudgetCampaign_year_idx" ON "BudgetCampaign" ("year");
CREATE INDEX IF NOT EXISTS "BudgetCampaign_status_idx" ON "BudgetCampaign" ("status");

CREATE TABLE IF NOT EXISTS "BudgetProposal" (
  "id"                     TEXT NOT NULL,
  "campaignId"             TEXT NOT NULL,
  "departmentId"           TEXT,
  "poleLabel"              TEXT NOT NULL,
  "domaine"                TEXT NOT NULL DEFAULT 'GENERAL',
  "cadrage"                DECIMAL(16,2),
  "status"                 TEXT NOT NULL DEFAULT 'EN_PREPARATION',
  "currentVersion"         INTEGER NOT NULL DEFAULT 0,
  "submittedById"          TEXT,
  "submittedAt"            TIMESTAMP(3),
  "decidedAt"              TIMESTAMP(3),
  "revisionAutorisee"      BOOLEAN NOT NULL DEFAULT false,
  "revisionAutoriseeParId" TEXT,
  "estRectificatif"        BOOLEAN NOT NULL DEFAULT false,
  "rectificatifs"          INTEGER NOT NULL DEFAULT 0,
  "envelopeId"             TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetProposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetProposal_envelopeId_key" ON "BudgetProposal" ("envelopeId");
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetProposal_campaignId_departmentId_key" ON "BudgetProposal" ("campaignId", "departmentId");
CREATE INDEX IF NOT EXISTS "BudgetProposal_status_idx" ON "BudgetProposal" ("status");

CREATE TABLE IF NOT EXISTS "BudgetProposalVersion" (
  "id"            TEXT NOT NULL,
  "proposalId"    TEXT NOT NULL,
  "version"       INTEGER NOT NULL,
  "lines"         JSONB NOT NULL,
  "total"         DECIMAL(16,2) NOT NULL DEFAULT 0,
  "rectificatif"  BOOLEAN NOT NULL DEFAULT false,
  "submittedById" TEXT,
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary"       TEXT,
  "summaryByLuna" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "BudgetProposalVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetProposalVersion_proposalId_version_key" ON "BudgetProposalVersion" ("proposalId", "version");

CREATE TABLE IF NOT EXISTS "BudgetProposalLine" (
  "id"             TEXT NOT NULL,
  "proposalId"     TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "categoryKey"    TEXT,
  "source"         TEXT NOT NULL DEFAULT 'SAISIE',
  "realise2026"    DECIMAL(16,2) NOT NULL DEFAULT 0,
  "propose"        DECIMAL(16,2) NOT NULL DEFAULT 0,
  "ajuste"         DECIMAL(16,2),
  "decision"       TEXT,
  "justification"  TEXT,
  "attachments"    JSONB NOT NULL DEFAULT '[]',
  "categoryLineId" TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetProposalLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetProposalLine_proposalId_key_key" ON "BudgetProposalLine" ("proposalId", "key");

CREATE TABLE IF NOT EXISTS "BudgetProposalComment" (
  "id"         TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "lineId"     TEXT,
  "authorId"   TEXT,
  "parLuna"    BOOLEAN NOT NULL DEFAULT false,
  "body"       TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetProposalComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BudgetProposalComment_proposalId_createdAt_idx" ON "BudgetProposalComment" ("proposalId", "createdAt");

CREATE TABLE IF NOT EXISTS "BudgetProposalVote" (
  "id"         TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "version"    INTEGER NOT NULL,
  "userId"     TEXT NOT NULL,
  "decision"   TEXT NOT NULL,
  "comment"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetProposalVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetProposalVote_proposalId_version_userId_key" ON "BudgetProposalVote" ("proposalId", "version", "userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposal_campaignId_fkey') THEN
    ALTER TABLE "BudgetProposal"
      ADD CONSTRAINT "BudgetProposal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BudgetCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposal_departmentId_fkey') THEN
    ALTER TABLE "BudgetProposal"
      ADD CONSTRAINT "BudgetProposal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposalVersion_proposalId_fkey') THEN
    ALTER TABLE "BudgetProposalVersion"
      ADD CONSTRAINT "BudgetProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "BudgetProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposalLine_proposalId_fkey') THEN
    ALTER TABLE "BudgetProposalLine"
      ADD CONSTRAINT "BudgetProposalLine_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "BudgetProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposalComment_proposalId_fkey') THEN
    ALTER TABLE "BudgetProposalComment"
      ADD CONSTRAINT "BudgetProposalComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "BudgetProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetProposalVote_proposalId_fkey') THEN
    ALTER TABLE "BudgetProposalVote"
      ADD CONSTRAINT "BudgetProposalVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "BudgetProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. L'ORGANIGRAMME, SEULE SOURCE ─────────────────────────────────────────────────────────────────────────────────────
-- a) Une fiche SANS département dont le compte en porte un : on ne perd pas l'information, la fiche la reprend.
UPDATE "Employee" e
   SET "departmentId" = u."departmentId"
  FROM "User" u
 WHERE e."userId" = u."id"
   AND e."departmentId" IS NULL
   AND u."departmentId" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "Department" d WHERE d."id" = u."departmentId");

-- b) Le libellé texte de la fiche = le nom du département structuré (cache dérivé).
UPDATE "Employee" e
   SET "department" = d."name"
  FROM "Department" d
 WHERE e."departmentId" = d."id"
   AND e."department" IS DISTINCT FROM d."name";

-- c) Le compte suit sa fiche.
UPDATE "User" u
   SET "departmentId" = e."departmentId"
  FROM "Employee" e
 WHERE e."userId" = u."id"
   AND u."departmentId" IS DISTINCT FROM e."departmentId";
