-- LA PAIE ET LA CAISSE D'AVANCE PASSENT PAR LE CENTRE DE PAIEMENT (§118.176) — idempotente :
-- rejouée, elle ne fait rien.
--
-- « La caisse qui est donnée mensuellement aux moyens généraux ainsi que la paie doivent
-- dorénavant aussi passer par le centre de paiement et attendre la validation. Pour la paie,
-- c'est un bouton pour toute la paie avec mention obligatoire de la somme des salaires à virer
-- (un bouton par entité). »
--
-- Aucune donnée existante n'est réécrite : une remise d'avant la règle garde son écriture et se
-- confirme comme avant ; un salaire d'avant garde son ancien « transfert au budget ».

-- 1. La remise de caisse d'avance porte l'ordre de dépense qui la paie.
ALTER TABLE "PettyCashAllotment" ADD COLUMN IF NOT EXISTS "expenseOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PettyCashAllotment_expenseOrderId_key" ON "PettyCashAllotment"("expenseOrderId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashAllotment_expenseOrderId_fkey') THEN
    ALTER TABLE "PettyCashAllotment" ADD CONSTRAINT "PettyCashAllotment_expenseOrderId_fkey"
      FOREIGN KEY ("expenseOrderId") REFERENCES "ExpenseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Le virement de la paie d'une entité pour un mois.
CREATE TABLE IF NOT EXISTS "PayrollWire" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "expenseOrderId" TEXT,
  "paidAt" TIMESTAMP(3),
  "transactionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollWire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollWire_expenseOrderId_key" ON "PayrollWire"("expenseOrderId");
CREATE INDEX IF NOT EXISTS "PayrollWire_companyId_year_month_idx" ON "PayrollWire"("companyId", "year", "month");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollWire_companyId_fkey') THEN
    ALTER TABLE "PayrollWire" ADD CONSTRAINT "PayrollWire_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollWire_expenseOrderId_fkey') THEN
    ALTER TABLE "PayrollWire" ADD CONSTRAINT "PayrollWire_expenseOrderId_fkey"
      FOREIGN KEY ("expenseOrderId") REFERENCES "ExpenseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Un salaire porte le virement qui le paie.
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "payrollWireId" TEXT;
CREATE INDEX IF NOT EXISTS "PayrollEntry_payrollWireId_idx" ON "PayrollEntry"("payrollWireId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollEntry_payrollWireId_fkey') THEN
    ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollWireId_fkey"
      FOREIGN KEY ("payrollWireId") REFERENCES "PayrollWire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
