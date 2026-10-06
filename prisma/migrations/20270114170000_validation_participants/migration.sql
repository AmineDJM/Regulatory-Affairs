-- LES PARTICIPANTS D'UNE DEMANDE DE VALIDATION (Direction, 06/10) : des collègues ajoutés à la demande, qui la lisent
-- et prennent part à sa discussion. Additif et idempotent.
CREATE TABLE IF NOT EXISTS "ValidationParticipant" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValidationParticipant_requestId_userId_key" ON "ValidationParticipant"("requestId", "userId");
CREATE INDEX IF NOT EXISTS "ValidationParticipant_userId_idx" ON "ValidationParticipant"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ValidationParticipant_requestId_fkey') THEN
    ALTER TABLE "ValidationParticipant" ADD CONSTRAINT "ValidationParticipant_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "ValidationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;