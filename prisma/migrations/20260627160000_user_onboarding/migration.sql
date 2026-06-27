-- Onboarding guidé : indicateur « setup à faire » + horodatage de complétion.
ALTER TABLE "User" ADD COLUMN "mustOnboard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
