-- RENVOYER POUR CORRECTION (audit 360°, R02 — CLAUDE.md §118.186).
--
-- Une étape du circuit de validation Ad & Pro peut désormais rendre la main au DEMANDEUR, motif à
-- l'appui, au lieu de choisir entre approuver et refuser. La demande n'est alors ni « en attente
-- de décision » (personne ne décide), ni « refusée » (rien n'est tranché) : elle est À CORRIGER.
--
-- Une valeur d'énumération NEUVE ne sert pas dans la transaction qui l'ajoute (« unsafe use of new
-- value ») : cette migration ne fait QUE les ajouter, aucune ligne n'est réécrite. Idempotente.
ALTER TYPE "SponsoringStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "CongressRequestStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
