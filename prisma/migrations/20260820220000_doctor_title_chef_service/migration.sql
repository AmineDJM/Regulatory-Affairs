-- « Chef de service » dans les grades de l'annuaire.
--
-- C'est une FONCTION hospitalière plutôt qu'un grade universitaire — mais c'est ainsi qu'un
-- praticien se présente, et c'est ce qu'un délégué écrit sur sa fiche. L'absence de la valeur
-- faisait retomber ces praticiens sur « Autre », où l'on ne les retrouve plus.
--
-- Idempotent : `ADD VALUE IF NOT EXISTS` fonctionne dans un bloc DO sur PostgreSQL 16.
DO $$ BEGIN
  ALTER TYPE "DoctorTitle" ADD VALUE IF NOT EXISTS 'CHEF_DE_SERVICE';
EXCEPTION WHEN others THEN NULL; END $$;
