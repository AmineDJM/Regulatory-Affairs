-- Points de passage des courses chauffeur (point A, B, C…) — idempotent.
CREATE TABLE IF NOT EXISTS "DriverMissionStop" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "task" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "DriverMissionStop_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "DriverMissionStop"
        ADD CONSTRAINT "DriverMissionStop_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "DriverMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "DriverMissionStop_missionId_position_idx" ON "DriverMissionStop"("missionId", "position");
