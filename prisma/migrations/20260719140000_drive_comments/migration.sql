-- Commentaires par document/dossier du Drive (fil de discussion par nœud).
CREATE TABLE IF NOT EXISTS "DriveComment" (
  "id"        TEXT NOT NULL,
  "nodeId"    TEXT NOT NULL,
  "authorId"  TEXT,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriveComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DriveComment_nodeId_idx" ON "DriveComment"("nodeId");
DO $$ BEGIN
  ALTER TABLE "DriveComment" ADD CONSTRAINT "DriveComment_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DriveComment" ADD CONSTRAINT "DriveComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
