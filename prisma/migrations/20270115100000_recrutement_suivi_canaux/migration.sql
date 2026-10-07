-- RECRUTEMENT (Direction, 07/10) : le N+1 de la future recrue et les personnes en charge du suivi (décidés par le DG), les canaux
-- de diffusion de l'offre. Additive et idempotente.
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "futureManagerId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentRequest_futureManagerId_fkey') THEN
    ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_futureManagerId_fkey" FOREIGN KEY ("futureManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RecruitmentFollower" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentFollower_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentFollower_requestId_userId_key" ON "RecruitmentFollower"("requestId", "userId");
CREATE INDEX IF NOT EXISTS "RecruitmentFollower_userId_idx" ON "RecruitmentFollower"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentFollower_requestId_fkey') THEN
    ALTER TABLE "RecruitmentFollower" ADD CONSTRAINT "RecruitmentFollower_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentFollower_userId_fkey') THEN
    ALTER TABLE "RecruitmentFollower" ADD CONSTRAINT "RecruitmentFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RecruitmentChannelPost" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARE',
  "content" TEXT,
  "url" TEXT,
  "error" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentChannelPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentChannelPost_requestId_channel_key" ON "RecruitmentChannelPost"("requestId", "channel");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentChannelPost_requestId_fkey') THEN
    ALTER TABLE "RecruitmentChannelPost" ADD CONSTRAINT "RecruitmentChannelPost_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentChannelPost_publishedById_fkey') THEN
    ALTER TABLE "RecruitmentChannelPost" ADD CONSTRAINT "RecruitmentChannelPost_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;