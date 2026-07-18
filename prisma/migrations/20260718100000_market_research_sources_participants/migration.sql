-- Market Research : sources de données (modifiables) + participants (collaborateurs).
ALTER TABLE "MarketResearch" ADD COLUMN IF NOT EXISTS "sources" TEXT;
ALTER TABLE "MarketResearch" ADD COLUMN IF NOT EXISTS "participantIds" TEXT[] NOT NULL DEFAULT '{}'::text[];
