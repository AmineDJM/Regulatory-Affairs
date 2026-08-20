-- INTÉRIMAIRE D'UN CONGÉ — quelqu'un tient la place pendant l'absence.
--
-- L'absent DÉSIGNE (il est seul à savoir qui peut le remplacer sur son métier), les RH VALIDENT
-- (sans quoi chacun se choisirait un remplaçant complaisant, et la délégation deviendrait un
-- moyen de contourner un circuit), et la délégation ne vit QUE pendant le congé : c'est le
-- calendrier qui la ferme, pas la mémoire de quelqu'un.
--
-- `standInModules` limite ce qui est prêté : jamais tout le compte. Un directeur en congé délègue
-- ses validations, pas la lecture de ses courriels.
--
-- Idempotent : ce fichier peut se rejouer sans erreur sur une base déjà migrée.

DO $$
BEGIN
    CREATE TYPE "StandInStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInId"          TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInStatus"      "StandInStatus";
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInModules"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInDecidedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInDecidedAt"   TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "standInNote"        TEXT;

CREATE INDEX IF NOT EXISTS "LeaveRequest_standInId_standInStatus_idx"
    ON "LeaveRequest"("standInId", "standInStatus");

-- Le compte de l'intérimaire disparaît → le rattachement est détaché (SET NULL), la demande de
-- congé reste. Effacer le congé parce que le remplaçant a quitté la société réécrirait l'histoire.
DO $$
BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_standInId_fkey"
        FOREIGN KEY ("standInId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
