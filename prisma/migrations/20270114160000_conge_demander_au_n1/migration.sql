-- DEMANDER À SON N+1 (Direction, 06/10) : la marche N+1 d'un congé peut remonter d'échelon en échelon, et les
-- validations redescendent, tracées. Additif et idempotent : aucune ligne existante n'est réécrite.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "currentApproverId" TEXT;
CREATE INDEX IF NOT EXISTS "LeaveRequest_currentApproverId_idx" ON "LeaveRequest"("currentApproverId");

CREATE TABLE IF NOT EXISTS "LeaveEscalation" (
  "id" TEXT NOT NULL,
  "leaveId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "note" TEXT,
  "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decision" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "LeaveEscalation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveEscalation_leaveId_order_key" ON "LeaveEscalation"("leaveId", "order");
CREATE INDEX IF NOT EXISTS "LeaveEscalation_toUserId_idx" ON "LeaveEscalation"("toUserId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveEscalation_leaveId_fkey') THEN
    ALTER TABLE "LeaveEscalation" ADD CONSTRAINT "LeaveEscalation_leaveId_fkey"
      FOREIGN KEY ("leaveId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
