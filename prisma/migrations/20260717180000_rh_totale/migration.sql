-- RH « la totale » : acquisition auto des congés + demandes RH par type (période + verrou solde).

-- Employé : marqueur d'acquisition mensuelle des congés (YYYY-MM du dernier mois crédité).
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveAccruedThrough" TEXT;

-- Demande RH : période demandée (congé/absence) + jours + verrou de débit du solde.
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "periodDays" DECIMAL(5,1);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "balanceAppliedAt" TIMESTAMP(3);
