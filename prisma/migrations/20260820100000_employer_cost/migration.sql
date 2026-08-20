-- LE COÛT EMPLOYEUR — ce qui fait vraiment la masse salariale.
--
-- Le brut est ce qui figure au bulletin ; le COÛT EMPLOYEUR est ce que le salarié coûte à la
-- société, charges patronales comprises. Deux personnes au même brut ne coûtent pas la même
-- chose : additionner des bruts donne une masse salariale fausse, et c'est pourtant elle qu'on
-- oppose au budget.
--
-- Colonnes NULLABLES, et c'est délibéré : on ne DEVINE pas le coût employeur des mois déjà
-- saisis en appliquant un taux moyen — ce serait inventer des chiffres dans un module qui sert
-- à décider. Un mois sans coût employeur retombe sur son brut, et l'écran dit d'où vient le
-- chiffre (voir `src/lib/hr/payroll-cost.ts`).
-- Idempotent : rejouable sur une instance déjà migrée.

ALTER TABLE "Employee"     ADD COLUMN IF NOT EXISTS "employerCost" DECIMAL(12,2);
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "employerCost" DECIMAL(12,2);
