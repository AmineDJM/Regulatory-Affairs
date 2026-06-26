-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONGRESS', 'SEMINAR', 'ROUND_TABLE', 'HOSPITAL_STAFF', 'SYMPOSIUM', 'WEBINAR', 'TRAINING', 'SCIENTIFIC_DAY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventScope" AS ENUM ('NATIONAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('PRESENTIAL', 'WEBINAR', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'AWAITING_VALIDATION', 'VALIDATED', 'PREPARATION', 'REGISTRATION_OPEN', 'FULL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('DOCTOR', 'PROFESSOR', 'HEAD_OF_SERVICE', 'PHARMACIST', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'PENDING', 'REJECTED', 'PRESENT', 'ABSENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'CONGRESS',
    "scope" "EventScope" NOT NULL DEFAULT 'NATIONAL',
    "format" "EventFormat" NOT NULL DEFAULT 'PRESENTIAL',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "city" TEXT,
    "country" TEXT,
    "specialty" TEXT,
    "products" TEXT,
    "description" TEXT,
    "capacity" INTEGER,
    "estimatedBudget" DECIMAL(14,2),
    "meetingLink" TEXT,
    "responsibleId" TEXT,
    "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT,
    "institution" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" "ParticipantRole" NOT NULL DEFAULT 'DOCTOR',
    "comment" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "qrToken" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_qrToken_key" ON "EventRegistration"("qrToken");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_status_idx" ON "EventRegistration"("status");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

