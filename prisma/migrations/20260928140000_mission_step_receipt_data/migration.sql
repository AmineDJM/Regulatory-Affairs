-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE REÇU STRUCTURÉ — pour que le juge constate au lieu de croire.
--
-- LE DÉFAUT MESURÉ. Run Render du 28/08 : trois scénarios, trois refus du juge, et la même
-- cause derrière les trois. Le compte rendu qu'il reçoit ne contient que du texte — une clé, un
-- titre, les 24 premiers caractères d'un reçu opaque, 180 caractères de JSON tronqué. Aucun
-- compte de résultats, aucune requête, aucun effet.
--
--   « Aucun message n'est envoyé »        → critère SANS PREUVE, alors que la mission tournait
--                                           sous plafond ANALYZE et n'avait fait que lire.
--   « 0 résultat sur Zorbamyxine-K7 »     → impossible à citer comme preuve d'absence.
--
-- `receipt` (String) reste : c'est l'identifiant du reçu canonique de l'ERP, et il ne change
-- pas de sens. `receiptData` porte ce que le CODE a constaté de l'appel — effet, source,
-- requête, horodatage, nombre de résultats, empreinte.
--
-- Idempotent : `IF NOT EXISTS`.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "MissionStep" ADD COLUMN IF NOT EXISTS "receiptData" JSONB;
