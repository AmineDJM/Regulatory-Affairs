-- KPI SANS CODE (Direction, 08/10) : des KPI qu'on cree depuis l'ecran. Une definition (KpiDefinition, versionnee par
-- famille) choisit une brique de mesure ecrite une fois dans le code ; elle s'applique a un role, a l'equipe d'un
-- manager ou a une personne (KpiAssignment, avec un poids). Les valeurs calculees sont mises en cache (KpiValue) ; les
-- KPI evalues (KpiEvaluation), declares (KpiDeclaration) et importes (KpiImport) ont leur table ; la revue signee
-- (KpiReview) fige ses lignes ; chaque manager choisit sa frequence de revue (KpiReviewSetting).
--
-- Additif et idempotent. Seed : le modele de role KAM (6 KPI, poids 30/20/15/20/5/10), modifiable ensuite.

CREATE TABLE IF NOT EXISTS "KpiDefinition" (
  "id" TEXT NOT NULL,
  "famille" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "nom" TEXT NOT NULL,
  "description" TEXT,
  "nature" TEXT NOT NULL,
  "briques" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "params" JSONB NOT NULL DEFAULT '{}',
  "unite" TEXT NOT NULL,
  "sens" TEXT NOT NULL DEFAULT 'PLUS_HAUT',
  "cible" DOUBLE PRECISION,
  "seuilVert" DOUBLE PRECISION,
  "seuilOrange" DOUBLE PRECISION,
  "periode" TEXT NOT NULL DEFAULT 'MOIS',
  "grille" JSONB,
  "statut" TEXT NOT NULL DEFAULT 'ACTIF',
  "portee" TEXT NOT NULL DEFAULT 'EQUIPE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiDefinition_famille_version_key" ON "KpiDefinition"("famille", "version");
CREATE INDEX IF NOT EXISTS "KpiDefinition_statut_idx" ON "KpiDefinition"("statut");
CREATE INDEX IF NOT EXISTS "KpiDefinition_createdById_idx" ON "KpiDefinition"("createdById");

CREATE TABLE IF NOT EXISTS "KpiAssignment" (
  "id" TEXT NOT NULL,
  "famille" TEXT NOT NULL,
  "cible" TEXT NOT NULL,
  "role" TEXT,
  "managerUserId" TEXT,
  "userId" TEXT,
  "poids" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KpiAssignment_famille_idx" ON "KpiAssignment"("famille");
CREATE INDEX IF NOT EXISTS "KpiAssignment_role_idx" ON "KpiAssignment"("role");
CREATE INDEX IF NOT EXISTS "KpiAssignment_managerUserId_idx" ON "KpiAssignment"("managerUserId");
CREATE INDEX IF NOT EXISTS "KpiAssignment_userId_idx" ON "KpiAssignment"("userId");

CREATE TABLE IF NOT EXISTS "KpiValue" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periode" TEXT NOT NULL,
  "valeur" DOUBLE PRECISION,
  "numerateur" DOUBLE PRECISION,
  "denominateur" DOUBLE PRECISION,
  "detail" JSONB,
  "sourceManquante" TEXT,
  "importId" TEXT,
  "calculeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KpiValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiValue_definitionId_userId_periode_key" ON "KpiValue"("definitionId", "userId", "periode");
CREATE INDEX IF NOT EXISTS "KpiValue_userId_periode_idx" ON "KpiValue"("userId", "periode");

CREATE TABLE IF NOT EXISTS "KpiEvaluation" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periode" TEXT NOT NULL,
  "propositionNiveau" INTEGER,
  "propositionPreuves" JSONB,
  "justification" TEXT,
  "proposeLe" TIMESTAMP(3),
  "niveau" INTEGER,
  "commentaire" TEXT,
  "valideParId" TEXT,
  "valideLe" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiEvaluation_definitionId_userId_periode_key" ON "KpiEvaluation"("definitionId", "userId", "periode");
CREATE INDEX IF NOT EXISTS "KpiEvaluation_userId_periode_idx" ON "KpiEvaluation"("userId", "periode");

CREATE TABLE IF NOT EXISTS "KpiDeclaration" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periode" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "valeur" DOUBLE PRECISION NOT NULL,
  "pieceBlobId" TEXT,
  "pieceNom" TEXT,
  "pieceMime" TEXT,
  "statut" TEXT NOT NULL DEFAULT 'A_VALIDER',
  "motif" TEXT,
  "valideParId" TEXT,
  "valideLe" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiDeclaration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KpiDeclaration_definitionId_userId_periode_idx" ON "KpiDeclaration"("definitionId", "userId", "periode");
CREATE INDEX IF NOT EXISTS "KpiDeclaration_userId_idx" ON "KpiDeclaration"("userId");
CREATE INDEX IF NOT EXISTS "KpiDeclaration_statut_idx" ON "KpiDeclaration"("statut");

CREATE TABLE IF NOT EXISTS "KpiImport" (
  "id" TEXT NOT NULL,
  "famille" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "nomFichier" TEXT NOT NULL,
  "blobId" TEXT,
  "colonnePersonne" TEXT NOT NULL,
  "colonnePeriode" TEXT NOT NULL,
  "colonneValeur" TEXT NOT NULL,
  "lignes" INTEGER NOT NULL DEFAULT 0,
  "rejets" JSONB,
  "importeParId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KpiImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KpiImport_famille_idx" ON "KpiImport"("famille");

CREATE TABLE IF NOT EXISTS "KpiReview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periode" TEXT NOT NULL,
  "frequence" TEXT NOT NULL DEFAULT 'MENSUELLE',
  "score" DOUBLE PRECISION,
  "kpiSansDonnee" INTEGER NOT NULL DEFAULT 0,
  "detail" JSONB,
  "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
  "signeeParId" TEXT,
  "signeeLe" TIMESTAMP(3),
  "commentaireManager" TEXT,
  "commentaireLuna" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiReview_userId_periode_key" ON "KpiReview"("userId", "periode");

CREATE TABLE IF NOT EXISTS "KpiReviewSetting" (
  "id" TEXT NOT NULL,
  "managerUserId" TEXT NOT NULL,
  "frequence" TEXT NOT NULL DEFAULT 'MENSUELLE',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiReviewSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiReviewSetting_managerUserId_key" ON "KpiReviewSetting"("managerUserId");

-- Cles etrangeres internes aux tables KPI (gardees : rejouer la migration ne casse rien).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiValue_definitionId_fkey') THEN
    ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiEvaluation_definitionId_fkey') THEN
    ALTER TABLE "KpiEvaluation" ADD CONSTRAINT "KpiEvaluation_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiDeclaration_definitionId_fkey') THEN
    ALTER TABLE "KpiDeclaration" ADD CONSTRAINT "KpiDeclaration_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- LE MODELE DE ROLE KAM (Direction, 08/10 : « oui pour commencer par les KAM ») — six KPI, poids 100 au total.
-- Identifiants fixes : rejouer la migration ne duplique rien ; modifier un KPI cree une version 2 dans la meme famille.
INSERT INTO "KpiDefinition" ("id", "famille", "version", "nom", "description", "nature", "briques", "params", "unite", "sens", "cible", "periode", "grille", "statut", "portee", "updatedAt") VALUES
  ('kpi-kam-cibles-hab', 'kpi-kam-cibles-hab', 1, 'Cibles H·A·B vues à fréquence', 'Cibles H, A et B du panel ayant reçu au moins leur requis de visites ÷ cibles H, A et B du panel.', 'RATIO',
   ARRAY['CIBLES_VUES_A_FREQUENCE', 'CIBLES_PANEL'], '{"numerateur":{"brique":"CIBLES_VUES_A_FREQUENCE","lettres":["H","A","B"]},"denominateur":{"brique":"CIBLES_PANEL","lettres":["H","A","B"]}}'::jsonb,
   'POURCENT', 'PLUS_HAUT', 75, 'MOIS', NULL, 'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP),
  ('kpi-kam-decideurs-2x', 'kpi-kam-decideurs-2x', 1, 'Décideurs vus 2 fois / mois', 'Décideurs (lettre H) du panel vus au moins deux fois par mois ÷ décideurs du panel.', 'RATIO',
   ARRAY['CIBLES_VUES_N', 'CIBLES_PANEL'], '{"numerateur":{"brique":"CIBLES_VUES_N","lettres":["H"],"seuilN":2},"denominateur":{"brique":"CIBLES_PANEL","lettres":["H"]}}'::jsonb,
   'POURCENT', 'PLUS_HAUT', 80, 'MOIS', NULL, 'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP),
  ('kpi-kam-rapports-48h', 'kpi-kam-rapports-48h', 1, 'Rapports rendus en 48 h', 'Visites dont le rapport est rendu au plus 48 heures après ÷ visites à rapporter.', 'RATIO',
   ARRAY['RAPPORTS_DANS_DELAI', 'VISITES_A_RAPPORTER'], '{"numerateur":{"brique":"RAPPORTS_DANS_DELAI","heures":48},"denominateur":{"brique":"VISITES_A_RAPPORTER","heures":48}}'::jsonb,
   'POURCENT', 'PLUS_HAUT', 95, 'MOIS', NULL, 'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP),
  ('kpi-kam-qualite-presentation', 'kpi-kam-qualite-presentation', 1, 'Qualité de la présentation produit', 'Grille en quatre niveaux, pré-notée par Luna avec ses preuves (rapports, coaching), tranchée par le manager.', 'EVALUE',
   ARRAY[]::TEXT[], '{"numerateur":null,"denominateur":null}'::jsonb,
   'NIVEAU', 'PLUS_HAUT', 3, 'MOIS',
   '[{"libelle":"Insuffisant","critere":"Message absent ou erroné, pas d''adaptation au médecin."},{"libelle":"À développer","critere":"Message porté mais récité, objections non traitées."},{"libelle":"Maîtrisé","critere":"Message adapté au statut du médecin, objections traitées."},{"libelle":"Exemplaire","critere":"Engage le médecin, obtient un engagement concret."}]'::jsonb,
   'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP),
  ('kpi-kam-formations', 'kpi-kam-formations', 1, 'Formations suivies', 'Formations déclarées avec leur attestation, validées par le manager.', 'DECLARE',
   ARRAY[]::TEXT[], '{"numerateur":null,"denominateur":null}'::jsonb,
   'NOMBRE', 'PLUS_HAUT', 1, 'TRIMESTRE', NULL, 'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP),
  ('kpi-kam-messages', 'kpi-kam-messages', 1, 'Messages portés', 'Visites réalisées dont le rapport retient au moins un message pré-défini ÷ visites réalisées.', 'RATIO',
   ARRAY['VISITES_AVEC_MESSAGE', 'VISITES_REALISEES'], '{"numerateur":{"brique":"VISITES_AVEC_MESSAGE"},"denominateur":{"brique":"VISITES_REALISEES"}}'::jsonb,
   'POURCENT', 'PLUS_HAUT', 80, 'MOIS', NULL, 'ACTIF', 'CATALOGUE', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "KpiAssignment" ("id", "famille", "cible", "role", "poids", "updatedAt") VALUES
  ('kpa-md-cibles-hab', 'kpi-kam-cibles-hab', 'ROLE', 'MEDICAL_DELEGATE', 30, CURRENT_TIMESTAMP),
  ('kpa-md-decideurs-2x', 'kpi-kam-decideurs-2x', 'ROLE', 'MEDICAL_DELEGATE', 20, CURRENT_TIMESTAMP),
  ('kpa-md-rapports-48h', 'kpi-kam-rapports-48h', 'ROLE', 'MEDICAL_DELEGATE', 15, CURRENT_TIMESTAMP),
  ('kpa-md-qualite-presentation', 'kpi-kam-qualite-presentation', 'ROLE', 'MEDICAL_DELEGATE', 20, CURRENT_TIMESTAMP),
  ('kpa-md-formations', 'kpi-kam-formations', 'ROLE', 'MEDICAL_DELEGATE', 5, CURRENT_TIMESTAMP),
  ('kpa-md-messages', 'kpi-kam-messages', 'ROLE', 'MEDICAL_DELEGATE', 10, CURRENT_TIMESTAMP),
  ('kpa-ns-cibles-hab', 'kpi-kam-cibles-hab', 'ROLE', 'NATIONAL_SALES', 30, CURRENT_TIMESTAMP),
  ('kpa-ns-decideurs-2x', 'kpi-kam-decideurs-2x', 'ROLE', 'NATIONAL_SALES', 20, CURRENT_TIMESTAMP),
  ('kpa-ns-rapports-48h', 'kpi-kam-rapports-48h', 'ROLE', 'NATIONAL_SALES', 15, CURRENT_TIMESTAMP),
  ('kpa-ns-qualite-presentation', 'kpi-kam-qualite-presentation', 'ROLE', 'NATIONAL_SALES', 20, CURRENT_TIMESTAMP),
  ('kpa-ns-formations', 'kpi-kam-formations', 'ROLE', 'NATIONAL_SALES', 5, CURRENT_TIMESTAMP),
  ('kpa-ns-messages', 'kpi-kam-messages', 'ROLE', 'NATIONAL_SALES', 10, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
