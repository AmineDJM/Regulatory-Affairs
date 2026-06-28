-- Score d'adoption : cibles « 100 % » par dimension, réglables par le Super Admin.
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtActiveDays"  INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtTimeHours"   INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtDiversity"   INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtDurable"     INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtInteraction" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "AdoptionSetting" ADD COLUMN IF NOT EXISTS "tgtModules"     INTEGER NOT NULL DEFAULT 0;
