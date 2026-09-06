-- L'OBJECTIF DURABLE (mandat 6 §47) — distinct d'une mission, et il lui survit. Idempotent.
--
-- Une seule table, et les listes en JSONB : critères, jalons, risques et liens causaux se lisent
-- et s'écrivent toujours ENSEMBLE (on juge un objectif en entier, jamais un jalon isolé), et les
-- éclater en quatre tables aurait ajouté trois jointures pour aucune requête réelle.
-- Ce qui SE FILTRE — le propriétaire, l'état, l'échéance — est en colonne, et indexé.
CREATE TABLE IF NOT EXISTS "ExecutiveObjective" (
  "id"              TEXT PRIMARY KEY,
  "ownerId"         TEXT NOT NULL,
  -- L'objectif MOT POUR MOT. La reformulation est utile ; l'original fait foi quand on juge.
  "statement"       TEXT NOT NULL,
  "reformulation"   TEXT,
  -- ACTIF | ATTEINT | COMPROMIS | ABANDONNE
  "status"          TEXT NOT NULL DEFAULT 'ACTIF',
  "horizon"         TIMESTAMP(3),
  "criteria"        JSONB NOT NULL DEFAULT '[]',
  "milestones"      JSONB NOT NULL DEFAULT '[]',
  "risks"           JSONB NOT NULL DEFAULT '[]',
  -- Le graphe causal : { de, vers, direction, intensite, confiance, hypothese, preuves[] }.
  "links"           JSONB NOT NULL DEFAULT '[]',
  -- Les missions lancées POUR cet objectif : elles s'ajoutent, elles ne le remplacent pas.
  "missionIds"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- La dernière estimation, telle qu'elle a été calculée — avec ses facteurs, pour l'historique.
  "lastProbability" DOUBLE PRECISION,
  "lastFactors"     JSONB,
  "lastAssessedAt"  TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ExecutiveObjective_ownerId_status_idx" ON "ExecutiveObjective"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "ExecutiveObjective_horizon_idx" ON "ExecutiveObjective"("horizon");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExecutiveObjective_ownerId_fkey'
  ) THEN
    ALTER TABLE "ExecutiveObjective"
      ADD CONSTRAINT "ExecutiveObjective_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
