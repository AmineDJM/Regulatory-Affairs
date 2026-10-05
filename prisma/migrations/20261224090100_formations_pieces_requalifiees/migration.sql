-- Audit 360° (§118.184) — les pièces et l'historique des formations quittent le type DOSSIER.
--
-- On requalifie par le LIEN CAUSAL — l'identifiant existe dans la table des formations —, jamais
-- par ressemblance de nom ou de libellé : un vrai sujet (`Dossier`) ne porte pas l'identifiant d'une
-- formation, donc aucune pièce de sujet n'est touchée. Rejouer cette migration ne change rien.
UPDATE "Document" SET "entityType" = 'TRAINING'
 WHERE "entityType" = 'DOSSIER' AND "entityId" IN (SELECT "id" FROM "Training");

UPDATE "AuditLog" SET "entityType" = 'TRAINING'
 WHERE "entityType" = 'DOSSIER' AND "entityId" IN (SELECT "id" FROM "Training");
