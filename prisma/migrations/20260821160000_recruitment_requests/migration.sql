-- DEMANDES DE RECRUTEMENT — du besoin d'un directeur jusqu'à l'intégration.
--
-- Un directeur formule le besoin, sa hiérarchie valide marche par marche jusqu'au PDG, les RH
-- instruisent (et peuvent demander des précisions), puis le poste s'ouvre : CV reçus,
-- présélection par le demandeur, choix du PDG, entretiens, et enfin l'intégration — sauf pour un
-- consulting, qui reste un intervenant externe.
--
-- Idempotent : ce fichier peut se rejouer sans erreur sur une base déjà migrée.

-- CONSULTING rejoint les types de contrat. Distinct de FREELANCE (prestation ponctuelle) :
-- le recrutement d'un consultant suit le même circuit qu'une embauche mais ne débouche PAS sur
-- une fiche employé. Additif — aucune donnée existante n'est touchée.
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'CONSULTING';

DO $$
BEGIN
    CREATE TYPE "RecruitmentStage" AS ENUM (
        'CHAIN', 'HR_REVIEW', 'INFO_REQUESTED', 'SOURCING', 'ONBOARDING', 'CLOSED', 'REJECTED', 'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "RecruitmentApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "RecruitmentCandidateStatus" AS ENUM (
        'RECEIVED', 'SHORTLISTED', 'SELECTED', 'INTERVIEWED', 'HIRED', 'DECLINED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RecruitmentRequest" (
    "id"            TEXT NOT NULL,
    "reference"     TEXT NOT NULL,
    "companyId"     TEXT,
    "departmentId"  TEXT,
    "requesterId"   TEXT NOT NULL,
    "position"      TEXT NOT NULL,
    "headcount"     INTEGER NOT NULL DEFAULT 1,
    "contractType"  "ContractType" NOT NULL,
    "salaryMin"     DECIMAL(12,2),
    "salaryMax"     DECIMAL(12,2),
    "startDate"     TIMESTAMP(3),
    "endDate"       TIMESTAMP(3),
    "missions"      TEXT,
    "skills"        TEXT,
    "justification" TEXT,
    "stage"         "RecruitmentStage" NOT NULL DEFAULT 'CHAIN',
    "closingNote"   TEXT,
    "closedAt"      TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentRequest_reference_key" ON "RecruitmentRequest"("reference");
CREATE INDEX IF NOT EXISTS "RecruitmentRequest_stage_idx" ON "RecruitmentRequest"("stage");
CREATE INDEX IF NOT EXISTS "RecruitmentRequest_requesterId_idx" ON "RecruitmentRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "RecruitmentRequest_departmentId_idx" ON "RecruitmentRequest"("departmentId");
CREATE INDEX IF NOT EXISTS "RecruitmentRequest_companyId_stage_idx" ON "RecruitmentRequest"("companyId", "stage");

CREATE TABLE IF NOT EXISTS "RecruitmentApproval" (
    "id"         TEXT NOT NULL,
    "requestId"  TEXT NOT NULL,
    "order"      INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status"     "RecruitmentApprovalState" NOT NULL DEFAULT 'PENDING',
    "reason"     TEXT,
    "decidedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentApproval_requestId_order_key" ON "RecruitmentApproval"("requestId", "order");
CREATE INDEX IF NOT EXISTS "RecruitmentApproval_approverId_status_idx" ON "RecruitmentApproval"("approverId", "status");

CREATE TABLE IF NOT EXISTS "RecruitmentInfoRequest" (
    "id"           TEXT NOT NULL,
    "requestId"    TEXT NOT NULL,
    "askedById"    TEXT NOT NULL,
    "question"     TEXT NOT NULL,
    "answer"       TEXT,
    "answeredById" TEXT,
    "answeredAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentInfoRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecruitmentInfoRequest_requestId_createdAt_idx" ON "RecruitmentInfoRequest"("requestId", "createdAt");

CREATE TABLE IF NOT EXISTS "RecruitmentCandidate" (
    "id"              TEXT NOT NULL,
    "requestId"       TEXT NOT NULL,
    "fullName"        TEXT NOT NULL,
    "email"           TEXT,
    "phone"           TEXT,
    "source"          TEXT,
    "notes"           TEXT,
    "status"          "RecruitmentCandidateStatus" NOT NULL DEFAULT 'RECEIVED',
    "addedById"       TEXT,
    "shortlistedById" TEXT,
    "shortlistedAt"   TIMESTAMP(3),
    "selectedById"    TEXT,
    "selectedAt"      TIMESTAMP(3),
    "interviewAt"     TIMESTAMP(3),
    "interviewNote"   TEXT,
    "decidedAt"       TIMESTAMP(3),
    "employeeId"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentCandidate_employeeId_key" ON "RecruitmentCandidate"("employeeId");
CREATE INDEX IF NOT EXISTS "RecruitmentCandidate_requestId_status_idx" ON "RecruitmentCandidate"("requestId", "status");

-- Clés étrangères. Les demandes suivent leur entité et leur demandeur (RESTRICT par défaut :
-- on ne supprime pas un compte qui porte des demandes de recrutement en cours). Le DÉPARTEMENT
-- est détaché (SET NULL) — une réorganisation ne doit pas effacer la demande qui l'a précédée.
DO $$
BEGIN
    ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_departmentId_fkey"
        FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentApproval" ADD CONSTRAINT "RecruitmentApproval_requestId_fkey"
        FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentApproval" ADD CONSTRAINT "RecruitmentApproval_approverId_fkey"
        FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentInfoRequest" ADD CONSTRAINT "RecruitmentInfoRequest_requestId_fkey"
        FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentInfoRequest" ADD CONSTRAINT "RecruitmentInfoRequest_askedById_fkey"
        FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentInfoRequest" ADD CONSTRAINT "RecruitmentInfoRequest_answeredById_fkey"
        FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_requestId_fkey"
        FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_addedById_fkey"
        FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "RecruitmentCandidate" ADD CONSTRAINT "RecruitmentCandidate_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
