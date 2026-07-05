-- Période d'essai des employés : dates, renouvelable, renouvelée + dates de la 2e période.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialStart" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialEnd" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialRenewable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialRenewed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialRenewalStart" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "trialRenewalEnd" TIMESTAMP(3);
