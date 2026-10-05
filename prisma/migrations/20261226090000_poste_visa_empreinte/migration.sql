-- L'EMPREINTE DU VISA D'UN BON DE COMMANDE DE POSTE (§118.187 — audit 360°, R05).
--
-- Le montant et le prestataire que le centre de validation Ad & Pro a VUS en visant la demande de BC
-- (ou ceux qui sont passés aux Finances sous le seuil). L'émission compare ce qui part à ce qui a été
-- validé. AUCUN rétro-remplissage : écrire le montant d'aujourd'hui dans l'empreinte d'un visa donné
-- hier affirmerait que le centre l'a vu — c'est précisément ce que l'audit a trouvé faux. Une empreinte
-- nulle laisse le comportement d'avant (rien n'est comparé à l'émission). Idempotente.
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderVisaAmount" DECIMAL(14,2);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderVisaSupplier" TEXT;
