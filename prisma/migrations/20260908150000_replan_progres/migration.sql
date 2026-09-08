-- ══════════════════════════════════════════════════════════════════════════════════════════
-- LA FIN DU PLAFOND GLOBAL DE REPLANS.
--
-- `PLANS_MAX = 4` bornait une MISSION ENTIÈRE. Sur une mission longue de sept jalons, un seul
-- jalon qui s'y reprend à quatre fois consommait le budget des six autres, et la mission
-- mourait pour une difficulté locale déjà résolue. Le compteur était aussi indifférent au
-- CONTENU : il comptait pareil un planificateur qui répare quelque chose à chaque tour et un
-- planificateur qui remet le même plan devant le même mur.
--
-- Ce qui remplace le compteur, c'est le PROGRÈS (§118.18) : tant que le refus CHANGE, le
-- planificateur répare et mérite un tour ; dès qu'il REVIENT identique, il est bloqué.
--
--   `replanRefus`  — la signature (les CODES, jamais les clés d'étape) du dernier refus de
--                    compilation. C'est elle qu'on compare pour savoir si ça progresse.
--   `replanBloque` — vrai quand le refus s'est répété, ou quand le plafond OPÉRATIONNEL local
--                    est atteint. C'est ce booléen que la requête du battement lit : sans lui,
--                    une mission définitivement bloquée redeviendrait candidate à chaque
--                    battement pour se faire refuser un plan de plus.
--
-- ET IL SE REMET À FAUX. Une information NEUVE — une réponse humaine, un événement, une
-- modification demandée par la personne — rouvre le droit d'essayer : c'est la différence entre
-- « le planificateur tourne en rond » et « on ne lui avait rien donné de nouveau ».
--
-- SQL MANUEL IDEMPOTENT : rejouable sans effet.
-- ══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "replanRefus" TEXT;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "replanBloque" BOOLEAN NOT NULL DEFAULT false;

-- La requête du battement filtre là-dessus à chaque tour : l'index lui évite un balayage.
CREATE INDEX IF NOT EXISTS "Mission_status_replanBloque_idx" ON "Mission"("status", "replanBloque");
