-- COMPRESSION SANS PERTE AU REPOS (Direction, 05/10/2026 — §118.214).
--
-- Idempotente, et RIEN n'est réécrit : un blob d'avant garde `codec` NUL (octets bruts, lus tels
-- quels) et `storedSize` NUL. Seuls les dépôts d'après, que la mesure juge compressibles, portent
-- « br » : le clair est compressé puis chiffré. `sha256` et `size` continuent de dire le CLAIR
-- d'origine — l'empreinte d'un original reste vérifiable octet pour octet.

ALTER TABLE "FileBlob" ADD COLUMN IF NOT EXISTS "codec" TEXT;
ALTER TABLE "FileBlob" ADD COLUMN IF NOT EXISTS "storedSize" DOUBLE PRECISION;
