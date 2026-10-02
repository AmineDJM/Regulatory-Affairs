-- Graphe AMD, phase 1B (§118.181) — l'historique des plans de tournée sous son vrai type.
--
-- Les quatre gestes d'un plan (planifier, soumettre, escalader, décider) s'auditaient sous VISIT
-- avec l'identifiant du PLAN. On les requalifie par le LIEN CAUSAL — l'identifiant existe dans la
-- table des plans —, jamais par le texte du résumé : un identifiant de visite ne peut pas être celui
-- d'un plan, donc aucune vraie visite n'est touchée. Rejouée, la requête ne trouve plus rien.
--
-- Les audits d'avant SANS type (Business Unit, secteur, établissement, spécialité) restent tels
-- quels : rien ne dit à coup sûr à quel objet ils se rapportent, et deviner d'après le résumé
-- réécrirait l'histoire.
UPDATE "AuditLog"
SET "entityType" = 'TOUR_PLAN'
WHERE "entityType" = 'VISIT'
  AND "entityId" IN (SELECT "id" FROM "TourPlan");
