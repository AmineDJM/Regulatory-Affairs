-- RÉPARATION : l'unicité GLOBALE du nom de département devait disparaître avec la migration
-- « departments_per_company » (le nom est unique PAR ENTITÉ depuis), mais elle avait été créée
-- par l'init comme INDEX (`CREATE UNIQUE INDEX "Department_name_key"`), pas comme contrainte :
-- son `DROP CONSTRAINT IF EXISTS` n'a donc rien supprimé, silencieusement. Conséquence réelle :
-- deux entités ne pouvaient pas avoir chacune leur « Commercial » (P2002 → page d'erreur).
-- Les deux formes sont couvertes ; idempotent — sûr à rejouer.
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_name_key";
DROP INDEX IF EXISTS "Department_name_key";
