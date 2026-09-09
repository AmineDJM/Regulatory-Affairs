-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE PROGRÈS SE JUGE SUR TOUT CE QU'ON A DÉJÀ VU, PAS SUR LE DERNIER TOUR (§118.67)
--
-- `dernierRefus` seul ne retient qu'un pas. Une oscillation A → B → A → B passe alors pour du
-- progrès à chaque tour, et la boucle ne s'arrête qu'au plafond opérationnel. MESURÉ en live :
-- « Le refus a changé (INVALID_SHAPE → OBJECTIF_NON_CONSTATE) » écrit DEUX fois pour le même
-- jalon — cinq sous-plans, neuf versions de plan, 1,10 $ au lieu de 0,10 $.
--
-- IDEMPOTENT : rejouable sans effet sur une base déjà à jour.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "MissionMilestone" ADD COLUMN IF NOT EXISTS "refusVus" TEXT[] NOT NULL DEFAULT '{}';

-- Les jalons existants n'ont pas d'historique : on y sème le seul refus qu'on connaisse d'eux.
-- Sans cette ligne, un jalon qui vient d'être refusé repartirait comme s'il n'avait rien vu.
UPDATE "MissionMilestone"
   SET "refusVus" = ARRAY["dernierRefus"]
 WHERE "dernierRefus" IS NOT NULL AND cardinality("refusVus") = 0;
