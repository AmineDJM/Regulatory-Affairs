-- Graphe AMD, phase 2 (§118.183) — une Business Unit vise PLUSIEURS spécialités, dont une principale facultative.
--
-- « BU ≠ spécialité » (cahier des charges, §4) : la BU Specialty Care vise la neurologie, la dermatologie et
-- l'urologie. Une colonne `specialtyId` sur la BU aurait interdit le cas avancé ; une table de liaison le
-- permet, et la principale n'y est qu'un drapeau — elle sert l'affichage, elle ne restreint rien.
--
-- Idempotente : rejouée, elle ne crée rien de plus.
CREATE TABLE IF NOT EXISTS "BusinessUnitSpecialty" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "principale" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessUnitSpecialty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnitSpecialty_businessUnitId_specialtyId_key"
    ON "BusinessUnitSpecialty"("businessUnitId", "specialtyId");
CREATE INDEX IF NOT EXISTS "BusinessUnitSpecialty_specialtyId_idx"
    ON "BusinessUnitSpecialty"("specialtyId");

-- AU PLUS UNE PRINCIPALE PAR BU. Un index PARTIEL, que le schéma Prisma ne sait pas déclarer : c'est la base
-- qui tient la règle, et deux enregistrements simultanés ne peuvent pas en poser deux.
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnitSpecialty_une_principale"
    ON "BusinessUnitSpecialty"("businessUnitId") WHERE "principale";

DO $$ BEGIN
    ALTER TABLE "BusinessUnitSpecialty" ADD CONSTRAINT "BusinessUnitSpecialty_businessUnitId_fkey"
        FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RESTRICT : retirer du référentiel une spécialité qu'une BU vise changerait, en silence, ce que la BU
-- concerne. L'action le refuse en nommant les BU ; la base le refuse aussi, si un autre chemin essayait.
DO $$ BEGIN
    ALTER TABLE "BusinessUnitSpecialty" ADD CONSTRAINT "BusinessUnitSpecialty_specialtyId_fkey"
        FOREIGN KEY ("specialtyId") REFERENCES "MedicalSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
