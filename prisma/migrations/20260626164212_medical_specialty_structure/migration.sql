-- CreateEnum
CREATE TYPE "MedicalSector" AS ENUM ('HOSPITAL', 'LIBERAL', 'BOTH');

-- CreateEnum
CREATE TYPE "DoctorTitle" AS ENUM ('PROFESSEUR', 'MAITRE_CONFERENCES', 'MAITRE_ASSISTANT', 'PRATICIEN_SPECIALISTE', 'ASSISTANT', 'RESIDENT', 'GENERALISTE', 'PHARMACIEN', 'AUTRE');

-- AlterTable
ALTER TABLE "MedicalDoctor" ADD COLUMN     "sector" "MedicalSector" NOT NULL DEFAULT 'LIBERAL',
ADD COLUMN     "specialtyId" TEXT,
ADD COLUMN     "title" "DoctorTitle" NOT NULL DEFAULT 'AUTRE';

-- CreateTable
CREATE TABLE "MedicalSpecialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalSpecialty_name_key" ON "MedicalSpecialty"("name");

-- CreateIndex
CREATE INDEX "MedicalSpecialty_name_idx" ON "MedicalSpecialty"("name");

-- CreateIndex
CREATE INDEX "MedicalDoctor_specialtyId_idx" ON "MedicalDoctor"("specialtyId");

-- CreateIndex
CREATE INDEX "MedicalDoctor_sector_idx" ON "MedicalDoctor"("sector");

-- AddForeignKey
ALTER TABLE "MedicalDoctor" ADD CONSTRAINT "MedicalDoctor_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "MedicalSpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

