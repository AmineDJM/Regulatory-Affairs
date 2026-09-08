-- UNE BASE CANONIQUE PAR MISSION (#88, §118.65).
--
-- Deux étapes ARTIFACT d'un même plan — le classeur et le deck — appelaient le modèle
-- CHACUNE sur les mêmes données amont. Deux appels, deux specs, deux mises en forme : les
-- chiffres pouvaient différer, et personne ne comparait. L'empreinte des données amont permet
-- au second de RE-RENDRE le premier au lieu de le refaire.
--
-- NULL = livrable antérieur à la règle : il ne sert de base à personne, ce qui est correct.
ALTER TABLE "MissionArtifact"
  ADD COLUMN IF NOT EXISTS "inputsHash" TEXT;

CREATE INDEX IF NOT EXISTS "MissionArtifact_missionId_inputsHash_idx"
  ON "MissionArtifact" ("missionId", "inputsHash");
