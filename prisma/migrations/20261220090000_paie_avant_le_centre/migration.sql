-- LA PAIE D'AVANT LE CENTRE DE PAIEMENT (§118.176) — idempotente : rejouée, elle ne fait rien.
--
-- Avant cette migration, « marquer payé » un salaire voulait dire qu'il était VERSÉ : l'ancien
-- circuit prévenait le salarié « votre salaire a été versé » vingt-quatre heures après. Depuis, la
-- saisie n'est plus qu'une saisie : la paie part au centre de paiement, entité par entité. Sans
-- l'instant de la bascule, tout salaire marqué payé avant elle et jamais « transféré au budget »
-- apparaîtrait « à envoyer » au centre — et serait payé une SECONDE fois.
--
-- L'instant est posé UNE fois (COALESCE) et ne bouge plus : une seconde exécution ne le déplace
-- pas, donc ne requalifie jamais en « versée » une saisie faite après la bascule. Il est écrit en
-- UTC, la convention des dates Prisma, quel que soit le fuseau de la session.

ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "payrollCentreSince" TIMESTAMP(3);

INSERT INTO "AppSetting" ("id", "payrollCentreSince", "updatedAt")
VALUES ('global', (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
ON CONFLICT ("id") DO UPDATE
  SET "payrollCentreSince" = COALESCE("AppSetting"."payrollCentreSince", EXCLUDED."payrollCentreSince");
