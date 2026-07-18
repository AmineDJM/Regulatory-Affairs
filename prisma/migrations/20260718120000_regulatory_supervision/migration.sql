-- Regulatory : supervision (dates cibles + rôles superviseurs configurables)
-- Date cible de dépôt du dossier (la date cible d'enregistrement existe déjà : targetDate).
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "targetSubmissionDate" TIMESTAMP(3);

-- Rôles « superviseurs Regulatory » (en plus du Super Admin) : fixent priorité/dates,
-- reçoivent les notifications (nouveau dossier / dépôt) et demandent des MàJ de statut.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "regulatorySupervisorRoles" TEXT[] NOT NULL DEFAULT '{}'::text[];
