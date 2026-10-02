-- LA TRÉSORERIE ANCRÉE (§118.176) — idempotente : rejouée, elle ne fait rien.
--
-- Un compte de trésorerie porte désormais sa banque, son RIB, son entité titulaire et le fait
-- d'être le compte PRINCIPAL de son entité ; une écriture porte le compte d'où part (ou où arrive)
-- l'argent, figé au moment où elle s'écrit. Aucune donnée existante n'est réécrite : l'historique
-- garde un compte nul, et la lecture le rattache par son libellé ou par le compte principal.

ALTER TABLE "TreasuryAccount" ADD COLUMN IF NOT EXISTS "bank" TEXT;
ALTER TABLE "TreasuryAccount" ADD COLUMN IF NOT EXISTS "rib" TEXT;
ALTER TABLE "TreasuryAccount" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TreasuryAccount" ADD COLUMN IF NOT EXISTS "principal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TreasuryAccount" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryAccount_companyId_fkey') THEN
    ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "TreasuryAccount_companyId_idx" ON "TreasuryAccount"("companyId");

ALTER TABLE "FinanceTransaction" ADD COLUMN IF NOT EXISTS "treasuryAccountId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_treasuryAccountId_fkey') THEN
    ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_treasuryAccountId_fkey"
      FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "FinanceTransaction_treasuryAccountId_idx" ON "FinanceTransaction"("treasuryAccountId");
