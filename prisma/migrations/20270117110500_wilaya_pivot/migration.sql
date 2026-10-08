-- WILAYA PIVOT PAR TERRITOIRE KAM (Direction, 08/10) : « pour chaque KAM, la wilaya pivot avec un menu deroulant, utilisee
-- pour le In/Out de la segmentation : une visite dans la wilaya pivot = In, en dehors = Out ». Le champ vit sur le
-- secteur (SalesSector.wilayaPivot), choisi dans la liste fermee des 58 wilayas.
--
-- Reprise : quand la ville pivot actuelle (city) EST le nom d'une wilaya (casse et accents indifferents), elle devient la
-- wilaya pivot ; une ville qui n'est pas une wilaya (« Bab Ezzouar ») n'est pas devinee ici - la lecture continue de
-- la deduire de city tant qu'aucune wilaya n'est choisie.
--
-- LES MEDECINS CONCERNES PAR UNE DEMANDE AD & PRO (AdProMedecin) : le lien generique demande <-> annuaire. Pour un congres,
-- les invites (invitedDoctorIds) et les prises en charge (CareBeneficiary) restent LUS tels quels et s'additionnent
-- aux medecins concernes, sans doublon : rien n'est copie.
--
-- Idempotente : colonne, table, index et reprises ne s'ecrivent qu'une fois.

ALTER TABLE "SalesSector" ADD COLUMN IF NOT EXISTS "wilayaPivot" TEXT;

UPDATE "SalesSector" s
SET "wilayaPivot" = w.nom
FROM (VALUES ('Adrar'), ('Chlef'), ('Laghouat'), ('Oum El Bouaghi'), ('Batna'), ('Béjaïa'), ('Biskra'), ('Béchar'), ('Blida'), ('Bouira'), ('Tamanrasset'), ('Tébessa'), ('Tlemcen'), ('Tiaret'), ('Tizi Ouzou'), ('Alger'), ('Djelfa'), ('Jijel'), ('Sétif'), ('Saïda'), ('Skikda'), ('Sidi Bel Abbès'), ('Annaba'), ('Guelma'), ('Constantine'), ('Médéa'), ('Mostaganem'), ('M''Sila'), ('Mascara'), ('Ouargla'), ('Oran'), ('El Bayadh'), ('Illizi'), ('Bordj Bou Arréridj'), ('Boumerdès'), ('El Tarf'), ('Tindouf'), ('Tissemsilt'), ('El Oued'), ('Khenchela'), ('Souk Ahras'), ('Tipaza'), ('Mila'), ('Aïn Defla'), ('Naâma'), ('Aïn Témouchent'), ('Ghardaïa'), ('Relizane'), ('Timimoun'), ('Bordj Badji Mokhtar'), ('Ouled Djellal'), ('Béni Abbès'), ('In Salah'), ('In Guezzam'), ('Touggourt'), ('Djanet'), ('El M''Ghair'), ('El Meniaa')) AS w(nom)
WHERE s."wilayaPivot" IS NULL
  AND s."city" IS NOT NULL
  AND lower(translate(btrim(s."city"), 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'))
    = lower(translate(w.nom, 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'));

CREATE TABLE IF NOT EXISTS "AdProMedecin" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'BENEFICIAIRE',
  "montant" DECIMAL(14,2),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProMedecin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProMedecin_entityType_entityId_doctorId_key" ON "AdProMedecin"("entityType", "entityId", "doctorId");
CREATE INDEX IF NOT EXISTS "AdProMedecin_entityType_entityId_idx" ON "AdProMedecin"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AdProMedecin_doctorId_idx" ON "AdProMedecin"("doctorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProMedecin_doctorId_fkey') THEN
    ALTER TABLE "AdProMedecin" ADD CONSTRAINT "AdProMedecin_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
