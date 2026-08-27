-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE MISSION RUNTIME — une mission devient un objet DURABLE, pas une conversation en cours.
--
-- ── CE QUI EXISTAIT DÉJÀ, ET QU'ON NE REFAIT PAS ──────────────────────────────────────────
--
-- `Mission`, `MissionParticipant` et `MissionEvent` existent depuis la coordination humaine
-- (« demande à Regulatory, attends, relance, consolide »). Ce sont les BONNES tables : une
-- mission a un propriétaire, un objectif, des participants et un journal.
--
-- Ce qui leur manquait, c'est le corps d'exécution : les ÉTAPES, leurs DÉPENDANCES, les
-- WORKERS qui les portent, et l'APPROBATION d'un périmètre. On les ajoute ; on ne duplique
-- ni le journal (`MissionEvent`), ni le registre de faits (`BusinessEvent`, qui porte déjà
-- `missionId`), ni les reçus d'action (`AssistantActionIntent`, dont la réclamation atomique
-- est déjà l'idempotence du produit).
--
-- ── POURQUOI UN DISCRIMINANT PLUTÔT QU'UNE SECONDE TABLE ──────────────────────────────────
--
-- Deux tables `Mission` auraient produit deux « missions » dans l'interface, deux vocabulaires
-- et deux endroits où chercher. `kind` distingue la mission de COORDINATION (l'ancienne, qui
-- poursuit des humains) de la mission d'EXÉCUTION (la nouvelle, qui porte un DAG) sans les
-- séparer : elles partagent le propriétaire, l'objectif, le journal et les engagements.
--
-- ── IDEMPOTENCE DE CETTE MIGRATION ────────────────────────────────────────────────────────
--
-- Tout est `IF NOT EXISTS`. Elle peut être rejouée sans dommage — c'est la règle du projet, et
-- c'est ce qui permet de la déployer sans savoir dans quel état est la base d'en face.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── 1. LES ÉTATS DU RUNTIME ───────────────────────────
--
-- On ÉTEND l'énumération existante plutôt que d'en créer une seconde. Les valeurs historiques
-- (ACTIVE, WAITING, PARTIAL, NEEDS_CEO, READY_TO_SEND) restent celles des missions de
-- coordination déjà en base : les renommer aurait cassé des lignes réelles pour un gain
-- cosmétique. Les nouvelles décrivent la machine à états d'exécution.
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'PLANNING';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'RUNNING';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'WAITING_EVENT';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'WAITING_INPUT';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'WAITING_DEPENDENCY';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- ─────────────────────────── 2. LA MISSION, ÉTENDUE ───────────────────────────
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'COORDINATION';
-- L'objectif tel que le PDG l'a formulé, mot pour mot. `objective` est la reformulation ; le
-- BRUT est conservé parce que c'est lui qui fait foi quand on juge si l'objectif est atteint.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "goalRaw" TEXT;
-- Les critères d'acceptation, produits par le planner et VÉRIFIÉS avant COMPLETED (§20).
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "acceptance" JSONB NOT NULL DEFAULT '[]';
-- Les deux axes INDÉPENDANTS (§1) : difficulté de raisonnement, quantité de travail.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "complexity" TEXT;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "scale" TEXT;
-- La version du plan : un replan l'incrémente. Sert à savoir quelles étapes sont d'un plan
-- périmé sans les supprimer — l'historique d'une mission compte autant que son état.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "planVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "parentMissionId" TEXT;
-- Le résultat des deux contrôles finaux. `NULL` = pas encore évalué, ce qui n'est PAS `false`.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "goalSatisfied" BOOLEAN;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "qaPassed" BOOLEAN;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "goalVerdict" TEXT;
-- Observabilité (§54) : ce que la mission a réellement coûté.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "modelCalls" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "toolCalls" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "tokensIn" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "tokensOut" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
-- Concurrence maximale AUTORISÉE pour cette mission. Une limite OPÉRATIONNELLE (§4), jamais
-- une limite d'architecture : elle borne le débit, pas la taille du DAG.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "maxConcurrency" INTEGER NOT NULL DEFAULT 6;

CREATE INDEX IF NOT EXISTS "Mission_kind_status_idx" ON "Mission" ("kind", "status");
CREATE INDEX IF NOT EXISTS "Mission_parentMissionId_idx" ON "Mission" ("parentMissionId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mission_parentMissionId_fkey') THEN
    ALTER TABLE "Mission"
      ADD CONSTRAINT "Mission_parentMissionId_fkey"
      FOREIGN KEY ("parentMissionId") REFERENCES "Mission"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────── 3. L'ÉTAPE — le nœud du DAG ───────────────────────────
--
-- C'EST AUSSI LE CHECKPOINT (§14). Une table de checkpoints séparée aurait dupliqué l'état :
-- l'étape TERMINÉE, avec son reçu, EST le point de reprise. Au redémarrage, on relit les
-- étapes ; celles qui portent un reçu ne sont pas rejouées.
CREATE TABLE IF NOT EXISTS "MissionStep" (
  "id"             TEXT NOT NULL,
  "missionId"      TEXT NOT NULL,
  -- Le regroupement logique (« Communications », « Drive »). Sert à l'affichage ET au replan :
  -- on peut invalider un workstream sans toucher aux autres.
  "workstream"     TEXT NOT NULL DEFAULT 'default',
  -- La clé STABLE de l'étape dans le plan — c'est elle que les dépendances désignent.
  "key"            TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  -- La capacité appelée. `NULL` pour les nœuds de contrôle (attente, jonction).
  "capability"     TEXT,
  -- CAPABILITY | WORKER | WAIT_EVENT | WAIT_INPUT | APPROVAL | QA | ARTIFACT | JOIN
  "nodeType"       TEXT NOT NULL DEFAULT 'CAPABILITY',
  "input"          JSONB NOT NULL DEFAULT '{}',
  -- PENDING | READY | RUNNING | DONE | FAILED | SKIPPED | WAITING | CANCELLED
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "attempt"        INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"    INTEGER NOT NULL DEFAULT 3,
  -- LA CLÉ D'IDEMPOTENCE (§15). Unique par mission : un retry retrouve son reçu au lieu de
  -- réexécuter. C'est ce qui empêche 33 e-mails de partir deux fois.
  "idempotencyKey" TEXT,
  "result"         JSONB,
  "receipt"        TEXT,
  "error"          TEXT,
  -- La CAUSE classée de l'échec (§75) — c'est elle qui choisit la stratégie de récupération.
  "errorKind"      TEXT,
  -- Ce que l'étape attend, quand elle attend : { type, from, entity, until }.
  "waitFor"        JSONB,
  "planVersion"    INTEGER NOT NULL DEFAULT 1,
  "startedAt"      TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionStep_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionStep_missionId_fkey') THEN
    ALTER TABLE "MissionStep"
      ADD CONSTRAINT "MissionStep_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- La clé est UNIQUE dans la mission : c'est ce qui rend le plan ré-entrant. Recompiler le même
-- plan ne crée pas de doublons, il retrouve les étapes.
CREATE UNIQUE INDEX IF NOT EXISTS "MissionStep_missionId_key_key" ON "MissionStep" ("missionId", "key");
-- L'IDEMPOTENCE, garantie par la BASE et pas par la discipline de l'appelant.
CREATE UNIQUE INDEX IF NOT EXISTS "MissionStep_idempotencyKey_key" ON "MissionStep" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "MissionStep_missionId_status_idx" ON "MissionStep" ("missionId", "status");
CREATE INDEX IF NOT EXISTS "MissionStep_status_idx" ON "MissionStep" ("status");

-- ─────────────────────────── 4. LES ARÊTES ───────────────────────────
CREATE TABLE IF NOT EXISTS "MissionStepDep" (
  "id"       TEXT NOT NULL,
  "stepId"   TEXT NOT NULL,
  "dependsOnId" TEXT NOT NULL,
  CONSTRAINT "MissionStepDep_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionStepDep_stepId_fkey') THEN
    ALTER TABLE "MissionStepDep"
      ADD CONSTRAINT "MissionStepDep_stepId_fkey"
      FOREIGN KEY ("stepId") REFERENCES "MissionStep"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionStepDep_dependsOnId_fkey') THEN
    ALTER TABLE "MissionStepDep"
      ADD CONSTRAINT "MissionStepDep_dependsOnId_fkey"
      FOREIGN KEY ("dependsOnId") REFERENCES "MissionStep"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MissionStepDep_stepId_dependsOnId_key" ON "MissionStepDep" ("stepId", "dependsOnId");
CREATE INDEX IF NOT EXISTS "MissionStepDep_dependsOnId_idx" ON "MissionStepDep" ("dependsOnId");

-- ─────────────────────────── 5. LE WORKER ÉPHÉMÈRE ───────────────────────────
--
-- Un worker N'EST PAS un agent qui discute (§9). Il reçoit un objectif, des entrées, une liste
-- FERMÉE de capacités, rend un résultat structuré et se termine. Sa trace est ici pour
-- l'observabilité et pour la reprise — pas pour qu'un autre worker vienne lui parler.
CREATE TABLE IF NOT EXISTS "MissionWorkerRun" (
  "id"          TEXT NOT NULL,
  "missionId"   TEXT NOT NULL,
  "stepId"      TEXT,
  "objective"   TEXT NOT NULL,
  -- Le RÔLE de modèle demandé (« cheap », « standard », « planner »), jamais un nom de modèle :
  -- c'est la politique qui traduit, et elle peut changer sans toucher au métier (§11).
  "modelRole"   TEXT NOT NULL DEFAULT 'standard',
  "modelUsed"   TEXT,
  "allowed"     TEXT[] NOT NULL DEFAULT '{}',
  "input"       JSONB NOT NULL DEFAULT '{}',
  "output"      JSONB,
  "status"      TEXT NOT NULL DEFAULT 'RUNNING',
  "error"       TEXT,
  "tokensIn"    INTEGER NOT NULL DEFAULT 0,
  "tokensOut"   INTEGER NOT NULL DEFAULT 0,
  "costUsd"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"     TIMESTAMP(3),
  CONSTRAINT "MissionWorkerRun_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionWorkerRun_missionId_fkey') THEN
    ALTER TABLE "MissionWorkerRun"
      ADD CONSTRAINT "MissionWorkerRun_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionWorkerRun_stepId_fkey') THEN
    ALTER TABLE "MissionWorkerRun"
      ADD CONSTRAINT "MissionWorkerRun_stepId_fkey"
      FOREIGN KEY ("stepId") REFERENCES "MissionStep"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MissionWorkerRun_missionId_status_idx" ON "MissionWorkerRun" ("missionId", "status");
CREATE INDEX IF NOT EXISTS "MissionWorkerRun_stepId_idx" ON "MissionWorkerRun" ("stepId");

-- ─────────────────────────── 6. L'APPROBATION DE PÉRIMÈTRE ───────────────────────────
--
-- §32 : une confirmation peut autoriser TOUTE une mission. §33 : cette autorisation est
-- IMMUABLE — elle porte le hash de ce qui a été montré. Si le périmètre change matériellement
-- (destinataire, montant, action externe ajoutée), le hash ne correspond plus et une NOUVELLE
-- approbation est requise pour la partie modifiée.
--
-- On ne réutilise pas `AssistantActionIntent` ici : celui-ci autorise UNE action et porte son
-- reçu. Une approbation de mission autorise un ENSEMBLE, décrit par un hash — deux objets de
-- nature différente, que confondre rendrait l'un des deux faux.
CREATE TABLE IF NOT EXISTS "MissionApproval" (
  "id"          TEXT NOT NULL,
  "missionId"   TEXT NOT NULL,
  "scope"       TEXT NOT NULL,
  "summary"     TEXT NOT NULL,
  -- Le hash SHA-256 du périmètre autorisé (étapes + effets + destinataires).
  "scopeHash"   TEXT NOT NULL,
  -- Les clés d'étapes couvertes : c'est ce que l'approbation débloque, et rien d'autre.
  "stepKeys"    TEXT[] NOT NULL DEFAULT '{}',
  "level"       TEXT NOT NULL DEFAULT 'NORMAL',
  -- PENDING | GRANTED | REFUSED | EXPIRED | SUPERSEDED
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt"   TIMESTAMP(3),
  "sample"      JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionApproval_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionApproval_missionId_fkey') THEN
    ALTER TABLE "MissionApproval"
      ADD CONSTRAINT "MissionApproval_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MissionApproval_missionId_status_idx" ON "MissionApproval" ("missionId", "status");
CREATE INDEX IF NOT EXISTS "MissionApproval_status_idx" ON "MissionApproval" ("status");

-- ─────────────────────────── 7. L'ENGAGEMENT, RELIÉ À SA MISSION ───────────────────────────
--
-- `ExecutiveCommitment` existe déjà (« qui a promis quoi, pour quand »). Il lui manquait le
-- lien vers la mission qui l'a créé — sans quoi une réponse de Redouane ne peut pas réveiller
-- la bonne branche.
ALTER TABLE "ExecutiveCommitment" ADD COLUMN IF NOT EXISTS "missionId" TEXT;
ALTER TABLE "ExecutiveCommitment" ADD COLUMN IF NOT EXISTS "stepKey" TEXT;
ALTER TABLE "ExecutiveCommitment" ADD COLUMN IF NOT EXISTS "personId" TEXT;
ALTER TABLE "ExecutiveCommitment" ADD COLUMN IF NOT EXISTS "lastNudgeAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ExecutiveCommitment_missionId_idx" ON "ExecutiveCommitment" ("missionId");
CREATE INDEX IF NOT EXISTS "ExecutiveCommitment_personId_status_idx" ON "ExecutiveCommitment" ("personId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExecutiveCommitment_missionId_fkey') THEN
    ALTER TABLE "ExecutiveCommitment"
      ADD CONSTRAINT "ExecutiveCommitment_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────── 8. LE MODÈLE OPÉRATIONNEL ───────────────────────────
--
-- §81 : le vrai fichier Excel que l'assistante utilise pour ses bons de commande vaut mieux que
-- n'importe quel format qu'Adam inventerait. Une fois FOURNI et VALIDÉ par un humain, il devient
-- la référence — et Adam cesse de reposer la question.
--
-- §82 : un modèle n'est jamais promu en silence. `state` distingue ce qui a été OBSERVÉ de ce
-- qui a été APPROUVÉ ; seul l'approuvé fait autorité.
CREATE TABLE IF NOT EXISTS "OperationalTemplate" (
  "id"            TEXT NOT NULL,
  "ownerId"       TEXT NOT NULL,
  -- PURCHASE_ORDER | INVOICE | QUOTATION | PAYMENT_REQUEST | REGULATORY_LETTER | CONTRACT | …
  "type"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  -- OBSERVED | CANDIDATE | APPROVED | DEPRECATED
  "state"         TEXT NOT NULL DEFAULT 'OBSERVED',
  -- Le fichier de référence dans le Drive — jamais une copie du contenu ici.
  "driveNodeId"   TEXT,
  "fileName"      TEXT,
  "fileHash"      TEXT,
  -- Ce que l'analyse a compris du fichier : champs, cellules, règles de numérotation.
  "structure"     JSONB NOT NULL DEFAULT '{}',
  "rules"         JSONB NOT NULL DEFAULT '{}',
  "destinationFolderId" TEXT,
  "approvedById"  TEXT,
  "approvedAt"    TIMESTAMP(3),
  "usageCount"    INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"    TIMESTAMP(3),
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalTemplate_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OperationalTemplate_ownerId_fkey') THEN
    ALTER TABLE "OperationalTemplate"
      ADD CONSTRAINT "OperationalTemplate_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OperationalTemplate_ownerId_type_state_idx" ON "OperationalTemplate" ("ownerId", "type", "state");
-- UN SEUL modèle APPROUVÉ par type et par propriétaire. C'est la règle qui empêche « trois
-- formats historiques » de redevenir trois vérités concurrentes.
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalTemplate_owner_type_approved_key"
  ON "OperationalTemplate" ("ownerId", "type") WHERE "state" = 'APPROVED';
