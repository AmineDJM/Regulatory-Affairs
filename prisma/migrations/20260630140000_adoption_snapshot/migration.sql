-- Historique quotidien du score d'adoption (un instantané par utilisateur et par jour).

-- CreateTable
CREATE TABLE "AdoptionSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "components" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdoptionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdoptionSnapshot_userId_day_key" ON "AdoptionSnapshot"("userId", "day");

-- CreateIndex
CREATE INDEX "AdoptionSnapshot_day_idx" ON "AdoptionSnapshot"("day");

-- AddForeignKey
ALTER TABLE "AdoptionSnapshot" ADD CONSTRAINT "AdoptionSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
