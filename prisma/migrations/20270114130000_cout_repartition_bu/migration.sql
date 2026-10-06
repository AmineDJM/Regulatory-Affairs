-- RÈGLE D'ALLOCATION DES COÛTS PARTAGÉS D'UNE BU (cahier des charges §15, §85) : coûts directs, alloués et non
-- alloués ne se mélangent jamais. Additive et idempotente ; aucune ligne écrite.

CREATE TABLE IF NOT EXISTS "CoutRepartitionBu" (
  "id" TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "annee" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "pct" DECIMAL(5,2) NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoutRepartitionBu_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoutRepartitionBu_businessUnitId_annee_productId_key" ON "CoutRepartitionBu"("businessUnitId", "annee", "productId");
CREATE INDEX IF NOT EXISTS "CoutRepartitionBu_productId_idx" ON "CoutRepartitionBu"("productId");

DO $$ BEGIN
  ALTER TABLE "CoutRepartitionBu" ADD CONSTRAINT "CoutRepartitionBu_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CoutRepartitionBu" ADD CONSTRAINT "CoutRepartitionBu_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
