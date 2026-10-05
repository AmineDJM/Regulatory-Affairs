-- ANNULER SA DEMANDE TANT QU'ELLE N'EST PAS EXÉCUTÉE (décision de la Direction, 04/10).
-- Trois circuits n'avaient que « supprimer » ou rien : une demande RH, une rallonge de budget de
-- département et une rallonge de caisse. Elles se CLÔTURENT désormais (trace gardée, l'autre prévenu).
-- Idempotent : une valeur d'énumération ne s'ajoute qu'une fois, et aucune ligne n'est réécrite.
ALTER TYPE "HrRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "DeptBudgetRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PettyCashTopUpStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
