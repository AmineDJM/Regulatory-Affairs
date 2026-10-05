-- La TVA d'un devis n'est JAMAIS devinée (Direction, 06/10) : « les 76 000 DZD de TVA n'étaient pas écrits sur le
-- document, donc l'IA ne doit pas deviner, juste retranscrire ».
--
-- Jusqu'ici une colonne `tvaRate DEFAULT 19` inventait 19 % pour tout devis qui n'en imprimait pas, et le TTC
-- (476 000 pour 400 000 HT) en découlait. Désormais, pour AdProDevis ET PromoQuote :
--   • la colonne devient NULLABLE et perd son défaut : NULL = « la TVA n'a pas été indiquée depuis le papier ».
--
-- Additive et sans perte : AUCUNE valeur existante n'est modifiée (une TVA déjà enregistrée ne peut pas être
-- distinguée d'une TVA imprimée — on ne réécrit pas ce qu'on ne sait pas). Idempotente.

ALTER TABLE "AdProDevis" ALTER COLUMN "tvaRate" DROP NOT NULL;
ALTER TABLE "AdProDevis" ALTER COLUMN "tvaRate" DROP DEFAULT;
ALTER TABLE "PromoQuote" ALTER COLUMN "tvaRate" DROP NOT NULL;
ALTER TABLE "PromoQuote" ALTER COLUMN "tvaRate" DROP DEFAULT;
