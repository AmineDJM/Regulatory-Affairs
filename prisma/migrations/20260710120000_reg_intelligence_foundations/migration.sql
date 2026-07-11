-- Regulatory Intelligence OS — Phase 1 fondations. Idempotent.

-- ── Enums (idempotents) ──
DO $$ BEGIN CREATE TYPE "RegProcedureType" AS ENUM ('PRESUBMISSION','INITIAL_REGISTRATION','NEW_ACTIVE_SUBSTANCE','GENERIC','BIOSIMILAR','IMPORTED','LOCAL_MANUFACTURING','ADD_DOSAGE','ADD_PRESENTATION','EXTENSION_INDICATION','VARIATION','RENEWAL','TRANSFER','RESERVE_RESPONSE','SUPPLEMENT','WITHDRAWAL','CESSATION','OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegDossierStatus" AS ENUM ('DRAFT','INGESTING','INGESTED','ANALYSING','IN_REVIEW','SUPPLIER_LOOP','READY_FOR_REVIEW','SUBMITTED','DECISION','MAINTAINED','ARCHIVED','ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegDocKind" AS ENUM ('ORIGINAL','WORKING','APPROVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegDocSecurityStatus" AS ENUM ('PENDING','SAFE','BLOCKED_EXECUTABLE','BLOCKED_ENCRYPTED','BLOCKED_PATH','BLOCKED_OVERSIZE','SUSPICIOUS','CORRUPTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegDocExtractionStatus" AS ENUM ('PENDING','TEXT_EXTRACTED','OCR_REQUIRED','OCR_COMPLETED','LOW_CONFIDENCE','CORRUPTED','PASSWORD_PROTECTED','UNSUPPORTED','MANUAL_REVIEW_REQUIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegJobType" AS ENUM ('INGEST','EXTRACT','OCR','CLASSIFY','FACTS','RULES','AI_REVIEW','CHALLENGER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegJobStatus" AS ENUM ('QUEUED','RUNNING','DONE','FAILED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Tables ──
CREATE TABLE IF NOT EXISTS "RegulatoryFeatureAccess" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryFeatureAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryFeatureAccess_companyId_key" ON "RegulatoryFeatureAccess"("companyId");

CREATE TABLE IF NOT EXISTS "RegulatoryDossier" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "productId" TEXT,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "procedureType" "RegProcedureType" NOT NULL DEFAULT 'INITIAL_REGISTRATION',
  "status" "RegDossierStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryDossier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryDossier_reference_key" ON "RegulatoryDossier"("reference");
CREATE INDEX IF NOT EXISTS "RegulatoryDossier_companyId_idx" ON "RegulatoryDossier"("companyId");
CREATE INDEX IF NOT EXISTS "RegulatoryDossier_productId_idx" ON "RegulatoryDossier"("productId");
CREATE INDEX IF NOT EXISTS "RegulatoryDossier_status_idx" ON "RegulatoryDossier"("status");

CREATE TABLE IF NOT EXISTS "RegulatoryDossierVersion" (
  "id" TEXT NOT NULL,
  "dossierId" TEXT NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "label" TEXT,
  "originalZipBlobId" TEXT,
  "originalSha256" TEXT,
  "fileCount" INTEGER NOT NULL DEFAULT 0,
  "totalBytes" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryDossierVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryDossierVersion_dossierId_versionNo_key" ON "RegulatoryDossierVersion"("dossierId","versionNo");
CREATE INDEX IF NOT EXISTS "RegulatoryDossierVersion_dossierId_idx" ON "RegulatoryDossierVersion"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatoryDocument" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "kind" "RegDocKind" NOT NULL DEFAULT 'ORIGINAL',
  "originalPath" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "suggestedFilename" TEXT,
  "approvedFilename" TEXT,
  "ext" TEXT NOT NULL,
  "detectedMimeType" TEXT,
  "declaredMimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "sha256" TEXT NOT NULL,
  "compressionRatio" DOUBLE PRECISION,
  "securityStatus" "RegDocSecurityStatus" NOT NULL DEFAULT 'PENDING',
  "extractionStatus" "RegDocExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "blobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_dossierVersionId_idx" ON "RegulatoryDocument"("dossierVersionId");
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_sha256_idx" ON "RegulatoryDocument"("sha256");
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_securityStatus_idx" ON "RegulatoryDocument"("securityStatus");

CREATE TABLE IF NOT EXISTS "RegulatoryJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "dossierId" TEXT,
  "dossierVersionId" TEXT,
  "type" "RegJobType" NOT NULL,
  "status" "RegJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lockedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "error" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryJob_status_idx" ON "RegulatoryJob"("status");
CREATE INDEX IF NOT EXISTS "RegulatoryJob_dossierId_idx" ON "RegulatoryJob"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatoryAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "actorId" TEXT NOT NULL,
  "dossierId" TEXT,
  "dossierVersionId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryAuditLog_dossierId_idx" ON "RegulatoryAuditLog"("dossierId");
CREATE INDEX IF NOT EXISTS "RegulatoryAuditLog_companyId_idx" ON "RegulatoryAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "RegulatoryAuditLog_createdAt_idx" ON "RegulatoryAuditLog"("createdAt");
