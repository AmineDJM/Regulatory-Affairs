-- RH : statut « Accordée » pour les demandes de nature APPROBATION (congés / absences /
-- autorisations), distinct du flux documentaire (Prête / Remise). Idempotent.
ALTER TYPE "HrRequestStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
