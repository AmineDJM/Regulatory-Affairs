-- QUI PORTE UNE AUTORITÉ DE VALIDATION, et à partir de quel montant la direction générale entre.
--
-- Une autorité se rattache à un RÔLE, pas à une personne : « le directeur des opérations » valide,
-- quel que soit celui qui occupe le poste. Le jour où la personne change, rien à reprogrammer.
-- Seule exception assumée, la DIRECTION GÉNÉRALE : c'est une signature personnelle, nominative,
-- et elle se transfère nommément.

CREATE TABLE IF NOT EXISTS "AuthorityHolder" (
  "id"                TEXT NOT NULL,
  "authority"         TEXT NOT NULL,
  "roles"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "userIds"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "delegatedToUserId" TEXT,
  "delegatedById"     TEXT,
  "delegatedAt"       TIMESTAMP(3),
  "delegationNote"    TEXT,
  "updatedById"       TEXT,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorityHolder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuthorityHolder_authority_key" ON "AuthorityHolder" ("authority");

CREATE TABLE IF NOT EXISTS "PaymentThreshold" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT,
  "amount"      DECIMAL(14,2) NOT NULL DEFAULT 500000,
  "updatedById" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentThreshold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentThreshold_companyId_key" ON "PaymentThreshold" ("companyId");

-- CONFIGURATION DE DÉPART. Rattachement par RÔLE — « DIRECTION » porte déjà le libellé
-- « Direction des opérations » dans l'ERP, aucun rôle nouveau n'est donc nécessaire.
INSERT INTO "AuthorityHolder" ("id", "authority", "roles")
SELECT * FROM (VALUES
  ('auth_nat_sup',  'NATIONAL_SUPERVISOR', ARRAY['NATIONAL_SALES']),
  ('auth_prod_mgr', 'PRODUCT_MANAGER',     ARRAY['PRODUCT_MANAGER']),
  ('auth_hr',       'HR',                  ARRAY['FINANCE_BUDGET_MANAGER']),
  ('auth_ops',      'OPERATIONS',          ARRAY['DIRECTION']),
  ('auth_finance',  'FINANCE',             ARRAY['FINANCE_BUDGET_MANAGER'])
) AS v(id, authority, roles)
WHERE NOT EXISTS (SELECT 1 FROM "AuthorityHolder" a WHERE a.authority = v.authority);

-- DIRECTION GÉNÉRALE : nominative. On désigne la personne par son nom ; à défaut, on retombe
-- sur le rôle Super Admin pour ne jamais laisser une chaîne sans titulaire — un paiement bloqué
-- faute de configuration serait pire que le problème qu'on résout. Modifiable ensuite.
INSERT INTO "AuthorityHolder" ("id", "authority", "roles", "userIds")
SELECT
  'auth_dg', 'GENERAL_MANAGEMENT',
  CASE WHEN u.id IS NULL THEN ARRAY['SUPER_ADMIN'] ELSE ARRAY[]::TEXT[] END,
  CASE WHEN u.id IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY[u.id] END
FROM (
  SELECT id FROM "User"
  WHERE "isActive" AND (name ILIKE '%amine%djouama%' OR email ILIKE '%amine%djouama%')
  ORDER BY "createdAt" LIMIT 1
) u
RIGHT JOIN (SELECT 1) AS one ON true
WHERE NOT EXISTS (SELECT 1 FROM "AuthorityHolder" a WHERE a.authority = 'GENERAL_MANAGEMENT');

INSERT INTO "PaymentThreshold" ("id", "companyId", "amount")
SELECT 'threshold_default', NULL, 500000
WHERE NOT EXISTS (SELECT 1 FROM "PaymentThreshold" WHERE "companyId" IS NULL);
