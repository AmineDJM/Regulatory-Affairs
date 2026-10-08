-- MISSIONS AD & PRO RELIEES AU PROFIL (Direction, 10/2026).
--
-- Une assignation (accompagnant / delegue de reference) devient une INVITATION : la personne confirme ou decline
-- (motif). La mission porte ses propres dates et sa ville (reprises de la demande, modifiables : le sponsoring en
-- prend ainsi pour paraitre aux calendriers), les etapes facultatives que la personne AJOUTE (transport, hebergement,
-- materiel, note de frais), un retrait souple (archive) et les postes crees a la cloture pour les frais de l'equipe.
--
-- L'ordre de mission suit le circuit RH unique (HrDocumentRequest MISSION_ORDER), precede de la marche du N+1
-- (managerGate). Les demandes de materiel promotionnel peuvent etre reliees a une mission.
--
-- Additif et idempotent. Les assignations EXISTANTES valent CONFIRMEE (acceptees implicitement) : la colonne est
-- ajoutee avec ce defaut, puis le defaut passe a INVITEE pour les nouvelles.

DO $$ BEGIN
  CREATE TYPE "MissionResponse" AS ENUM ('INVITEE', 'CONFIRMEE', 'DECLINEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HrManagerGate" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "response" "MissionResponse" NOT NULL DEFAULT 'CONFIRMEE';
ALTER TABLE "MissionAssignment" ALTER COLUMN "response" SET DEFAULT 'INVITEE';
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "declineReason" TEXT;
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "nudgeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "dateDepart" TIMESTAMP(3);
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "dateRetour" TIMESTAMP(3);
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "ville" TEXT;
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "etapes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "transportPosteId" TEXT;
ALTER TABLE "MissionAssignment" ADD COLUMN IF NOT EXISTS "hebergementPosteId" TEXT;

ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "missionAssignmentId" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "managerGate" "HrManagerGate";
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "managerUserId" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "managerDecidedAt" TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "managerNote" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "omPrefill" JSONB;
CREATE INDEX IF NOT EXISTS "HrDocumentRequest_missionAssignmentId_idx" ON "HrDocumentRequest"("missionAssignmentId");

ALTER TABLE "PromoStockRequest" ADD COLUMN IF NOT EXISTS "missionAssignmentId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoStockRequest_missionAssignmentId_idx" ON "PromoStockRequest"("missionAssignmentId");
