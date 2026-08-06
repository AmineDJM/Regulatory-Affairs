-- AUTORISATIONS SUR LES BUDGETS DÉPARTEMENTAUX — réglées par le Super Admin.
--
-- Une ligne par département, plus UNE ligne générale (`departmentId IS NULL`) valable pour
-- tous. Trois portées, parce que ce ne sont pas les mêmes personnes : voir (`access*`),
-- éditer le fonctionnement (`operating*`), éditer les employés (`hr*`).
--
-- Aucune donnée initiale : la table vide signifie « rien n'a été réglé », et le socle par rôle
-- (gestionnaire de budget → fonctionnement, RH → employés) continue de s'appliquer seul. Les
-- autorisations s'AJOUTENT à ce socle — poser la première règle ne retire l'accès à personne.
--
-- Idempotent : table, contraintes et index sont tous conditionnels.

CREATE TABLE IF NOT EXISTS "DepartmentBudgetAccess" (
  "id"               TEXT NOT NULL,
  "departmentId"     TEXT,
  "accessRoles"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessUserIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "operatingRoles"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "operatingUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "hrRoles"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "hrUserIds"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "setById"          TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentBudgetAccess_pkey" PRIMARY KEY ("id")
);

-- Un département supprimé emporte ses autorisations (elles n'ont plus d'objet) ; un compte
-- supprimé laisse la règle en place, sans auteur — perdre une autorisation parce que la
-- personne qui l'a posée est partie ouvrirait un trou silencieux.
DO $$
BEGIN
  ALTER TABLE "DepartmentBudgetAccess"
    ADD CONSTRAINT "DepartmentBudgetAccess_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DepartmentBudgetAccess"
    ADD CONSTRAINT "DepartmentBudgetAccess_setById_fkey"
    FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Une seule règle PAR département…
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentBudgetAccess_departmentId_key"
  ON "DepartmentBudgetAccess" ("departmentId");

-- …et une seule règle GÉNÉRALE. L'index ci-dessus ne suffit pas : en SQL deux NULL ne
-- s'égalent pas, donc rien n'empêcherait de créer dix règles générales contradictoires.
-- Un index partiel sur une constante fixe le problème à la source.
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentBudgetAccess_general_key"
  ON "DepartmentBudgetAccess" ((1)) WHERE "departmentId" IS NULL;
