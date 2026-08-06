-- QUI A LE DROIT DE VOIR QUELLE ENTITÉ.
--
-- Le sélecteur d'entité n'était qu'une préférence d'affichage : il proposait toutes les entités
-- à tout le monde. Pour un groupe multi-entités c'est un défaut d'étanchéité.
--
-- ⚠️ REPRISE NON RESTRICTIVE : on accorde à CHAQUE utilisateur existant l'accès à CHAQUE entité
-- existante, en lecture ET écriture. Autrement dit, cette migration ne retire l'accès de
-- personne — elle installe seulement le mécanisme. C'est ensuite aux ressources humaines de
-- restreindre, entité par entité. Démarrer restrictif aurait enfermé tout le monde dans sa
-- propre entité du jour au lendemain, sans prévenir.

CREATE TABLE IF NOT EXISTS "UserCompanyAccess" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "canEdit"     BOOLEAN NOT NULL DEFAULT false,
  "grantedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCompanyAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCompanyAccess_userId_companyId_key" ON "UserCompanyAccess"("userId","companyId");
CREATE INDEX IF NOT EXISTS "UserCompanyAccess_userId_idx" ON "UserCompanyAccess"("userId");
CREATE INDEX IF NOT EXISTS "UserCompanyAccess_companyId_idx" ON "UserCompanyAccess"("companyId");

DO $$ BEGIN
  ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reprise : l'existant garde exactement ce qu'il avait. Rejouable.
INSERT INTO "UserCompanyAccess" ("id","userId","companyId","canEdit","createdAt","updatedAt")
SELECT 'mig_' || u."id" || '_' || c."id", u."id", c."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u CROSS JOIN "Company" c
ON CONFLICT ("userId","companyId") DO NOTHING;
