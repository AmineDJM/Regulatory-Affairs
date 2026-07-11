-- Regulatory Intelligence OS — G14 : upload résumable (sessions + parties). Idempotent.
DO $$ BEGIN CREATE TYPE "RegUploadStatus" AS ENUM ('UPLOADING','FINALIZING','COMPLETED','ABORTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryUploadSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dossierId" TEXT,
  "createdById" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT,
  "totalBytes" BIGINT NOT NULL,
  "partSize" INTEGER NOT NULL,
  "expectedSha256" TEXT,
  "receivedBytes" BIGINT NOT NULL DEFAULT 0,
  "status" "RegUploadStatus" NOT NULL DEFAULT 'UPLOADING',
  "blobId" TEXT,
  "versionId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryUploadSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryUploadSession_companyId_idx" ON "RegulatoryUploadSession"("companyId");
CREATE INDEX IF NOT EXISTS "RegulatoryUploadSession_status_idx" ON "RegulatoryUploadSession"("status");
CREATE INDEX IF NOT EXISTS "RegulatoryUploadSession_dossierId_idx" ON "RegulatoryUploadSession"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatoryUploadPart" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryUploadPart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryUploadPart_sessionId_index_key" ON "RegulatoryUploadPart"("sessionId","index");
CREATE INDEX IF NOT EXISTS "RegulatoryUploadPart_sessionId_idx" ON "RegulatoryUploadPart"("sessionId");

DO $$ BEGIN ALTER TABLE "RegulatoryUploadPart" ADD CONSTRAINT "RegulatoryUploadPart_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RegulatoryUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
