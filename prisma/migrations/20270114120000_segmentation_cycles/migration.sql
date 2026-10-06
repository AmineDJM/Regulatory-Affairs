-- CYCLES DE SEGMENTATION (cahier des charges §49-55, §84) : un cycle fige, à son ouverture, les règles et le résultat
-- de chaque praticien ; sa clôture fige les visites réalisées. Additive et idempotente ; aucune ligne écrite.

CREATE TABLE IF NOT EXISTS "SegmentationCycle" (
  "id" TEXT NOT NULL,
  "strategieId" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "duree" TEXT NOT NULL,
  "debut" TIMESTAMP(3) NOT NULL,
  "fin" TIMESTAMP(3) NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'OUVERT',
  "regleVersion" INTEGER NOT NULL,
  "instantane" JSONB NOT NULL,
  "capacite" JSONB NOT NULL,
  "realise" JSONB,
  "promoCycleId" TEXT,
  "ouvertParId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closLe" TIMESTAMP(3),
  "closParId" TEXT,
  CONSTRAINT "SegmentationCycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SegmentationCycle_strategieId_debut_idx" ON "SegmentationCycle"("strategieId", "debut");

DO $$ BEGIN
  ALTER TABLE "SegmentationCycle" ADD CONSTRAINT "SegmentationCycle_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "SegmentationStrategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
