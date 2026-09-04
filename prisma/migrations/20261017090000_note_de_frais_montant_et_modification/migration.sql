-- NOTE DE FRAIS : le MONTANT sort du texte, et la modification devient possible.
--
-- ── CE QUE CETTE MIGRATION AJOUTE ───────────────────────────────────────────────────────────
--
--   • `expenseAmount` — le montant avancé, séparé du motif. Il vivait DANS `details`
--     (« 4 200 DZD — taxi et péage ») : un montant noyé dans une phrase ne s'additionne pas et
--     ne se contrôle pas ;
--   • `editableUntil` — la fin des quinze minutes pendant lesquelles le demandeur se corrige ;
--   • `editUnlockedAt` / `editUnlockedById` — la réouverture décidée par les RH, avec son auteur.
--
-- ── LES NOTES DÉJÀ DÉPOSÉES ─────────────────────────────────────────────────────────────────
--
-- On ne DEVINE PAS leur montant en cherchant un nombre dans `details` : « 4 200 DZD de taxi,
-- refacturé sur le budget 2025 » contient deux nombres, et se tromper de colonne sur de l'argent
-- coûte plus cher que de laisser vide. Leur montant reste donc `NULL` — le texte d'origine est
-- toujours là, lisible — et les RH le saisiront s'ils en ont besoin.
--
-- Leur fenêtre de modification n'est pas ouverte rétroactivement : quinze minutes accordées à
-- une note vieille de trois semaines seraient déjà écoulées, et une réouverture massive serait
-- une décision que personne n'a prise.
--
-- Idempotent : rejouable sans effet.

ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "expenseAmount"    DECIMAL(12,2);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "editableUntil"    TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "editUnlockedAt"   TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "editUnlockedById" TEXT;
