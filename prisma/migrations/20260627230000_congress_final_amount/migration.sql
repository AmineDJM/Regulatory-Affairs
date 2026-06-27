-- Montant accordé par la Direction à la validation définitive d'un congrès / événement
ALTER TABLE "CongressInternational" ADD COLUMN "finalAmount" DECIMAL(14,2);
ALTER TABLE "CongressNational" ADD COLUMN "finalAmount" DECIMAL(14,2);
