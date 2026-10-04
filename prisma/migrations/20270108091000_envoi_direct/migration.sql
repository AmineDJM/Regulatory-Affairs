-- Envoi DIRECT navigateur → bucket d'un gros fichier (reprise après coupure).
CREATE TABLE IF NOT EXISTS "DirectUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "uploadId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "totalBytes" BIGINT NOT NULL,
  "partSize" INTEGER NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "target" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADING',
  "resultId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectUpload_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DirectUpload_userId_status_idx" ON "DirectUpload"("userId", "status");
CREATE INDEX IF NOT EXISTS "DirectUpload_status_updatedAt_idx" ON "DirectUpload"("status", "updatedAt");
