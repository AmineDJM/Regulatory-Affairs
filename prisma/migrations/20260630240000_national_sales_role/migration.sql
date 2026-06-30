-- Nouveau rôle « National Sales » : capacités du délégué médical + approbation
-- préliminaire des demandes (sponsoring / congrès / événements) avec choix du
-- chef de produit. PG16 : ADD VALUE est transactionnel ; on ne l'utilise pas dans
-- la même transaction que d'autres requêtes qui s'en serviraient.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'NATIONAL_SALES';
