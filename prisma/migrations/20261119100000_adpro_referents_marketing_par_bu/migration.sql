-- AD & PRO — LES RÉFÉRENTS DIRECTION MARKETING SE CONFIGURENT PAR GAMME.
--
-- Décision de la Direction (22/09/2026) : « chaque BU aura son ou ses référents de la direction
-- marketing depuis la configuration des BU, mais le directeur du département marketing recevra
-- ÉGALEMENT l'accès et la notif et pourra modifier, valider ».
--
-- La désignation CIBLE la notification ; elle n'accorde AUCUN droit (le pouvoir de trancher reste
-- gouverné par le rôle de l'étape). Elle donne enfin un écrivain à `productManagerId`, mais
-- seulement quand la gamme a UN SEUL référent — plusieurs n'en désignent aucun.
--
-- ON NE REMPLIT RIEN : déduire un référent du rôle de quelqu'un désignerait un arbitre que
-- personne n'a choisi, et sans référent le comportement d'aujourd'hui est EXACTEMENT conservé
-- (la notification par rôle reste seule).

CREATE TABLE IF NOT EXISTS "BusinessUnitMarketingReferent" (
  "id"             TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessUnitMarketingReferent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnitMarketingReferent_businessUnitId_userId_key"
  ON "BusinessUnitMarketingReferent"("businessUnitId", "userId");
CREATE INDEX IF NOT EXISTS "BusinessUnitMarketingReferent_userId_idx"
  ON "BusinessUnitMarketingReferent"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessUnitMarketingReferent_businessUnitId_fkey') THEN
    ALTER TABLE "BusinessUnitMarketingReferent"
      ADD CONSTRAINT "BusinessUnitMarketingReferent_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessUnitMarketingReferent_userId_fkey') THEN
    ALTER TABLE "BusinessUnitMarketingReferent"
      ADD CONSTRAINT "BusinessUnitMarketingReferent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
