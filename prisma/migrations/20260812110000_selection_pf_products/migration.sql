-- Import du portefeuille « Sélection PF Produits » (69 produits) dans Regulatory.
--
-- Source : data/selection-pf-produits.xlsx, versionnée dans le dépôt.
-- Généré par scripts/gen-selection-pf-migration.ts — NE PAS ÉDITER À LA MAIN : régénérer.
--
-- Correspondances (règles pures et testées, src/lib/regulatory/sheet-import.ts) :
--   Spé → classe thérapeutique · Priorisation 1..4 → Critique..Basse (vide = Moyenne)
--   Commercialisation Off/Hop → canal Ville/Hôpital · Statut Fabrication → niveau DÉCLARÉ
--   Forme + Conditionnement → forme galénique, dosage, unité, conditionnement
--   Quantités, prix FOB, taille de marché et concurrents → commentaires du dossier
--
-- Les dossiers arrivent en « Présoumission », sans responsable : la personne chargée du dossier
-- se choisit ensuite depuis le tableau Regulatory (colonne « Chargé du dossier »).
--
-- IDEMPOTENT : chaque produit porte un identifiant stable « regpfNNNN » et n'est inséré
-- que s'il est absent. Rejouer la migration ne crée aucun doublon.

INSERT INTO "RegulatoryProduct" (
  id, reference, dci, molecules, "brandName", dosage, "dosageUnit", "pharmaceuticalForm",
  packaging, "therapeuticClass", channel, "manufacturingStatus", priority, comments,
  category, "productType", status, "companyId", "portalVisible", "externalNotify",
  "createdAt", "updatedAt"
)
SELECT
  v.id,
  -- Référence dans la série de l'année, à la suite des dossiers existants : jamais de collision.
  'REG-' || EXTRACT(YEAR FROM now())::int || '-' || LPAD((base.n + v.idx)::text, 3, '0'),
  v.dci, v.molecules::jsonb, v.brand, v.dosage, v.unit, v.form,
  v.packaging, v.klass, v.channel::"ProductChannel", v.mfg::"ManufacturingStatus",
  v.prio::"Priority", v.comments,
  'MEDICINE'::"RegulatoryCategory", 'IMPORTED'::"ProductType", 'PRE_SUBMISSION'::"RegulatoryStatus",
  -- Entité : Adventum si elle existe, sinon la première entité active. Sans aucune entité, le
  -- dossier reste non rattaché et le tableau Regulatory le signale — on ne devine pas à sa place.
  COALESCE(
    (SELECT c.id FROM "Company" c WHERE c."isActive" AND c.name ILIKE '%adventum%' ORDER BY c."sortOrder", c."createdAt" LIMIT 1),
    (SELECT c.id FROM "Company" c WHERE c."isActive" ORDER BY c."sortOrder", c."createdAt" LIMIT 1)
  ),
  false, false, now(), now()
FROM (
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 'REG-[0-9]{4}-([0-9]+)$') AS INT)), 0) AS n
  FROM "RegulatoryProduct"
  WHERE reference LIKE 'REG-' || EXTRACT(YEAR FROM now())::int || '-%'
) base,
(VALUES
    ('regpf0001', 1, 'FINGOLIMOD', NULL, NULL, '0.5', 'MG', 'GELULE', 'B/28', 'Neurologie', 'HOSPITAL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GELULE 0,5MG — B/28
Statut visé (feuille) : Fabrication
Marché : quantité marché PCH 2724.32, prix FOB 688.64, taille de marché 1,876,067 $, 1 acteur(s).
Concurrence : HIKMA 100%.'),
    ('regpf0002', 2, 'DIMETHYL FUMARATE', NULL, NULL, '120', 'MG', 'GELULE', 'B/14', 'Neurologie', 'BOTH', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GELULE 120 MG — B/14
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 2,049, quantité marché PCH 2657.14, prix FOB 77.27, taille de marché 363,656 $, 1 acteur(s).
Concurrence : HIKMA 100%.'),
    ('regpf0003', 3, 'DIMETHYL FUMARATE', NULL, NULL, '240', 'MG', 'GELULE', 'B/56', 'Neurologie', 'BOTH', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GELULE 240 MG — B/56
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 11,601, quantité marché PCH 5446.43, prix FOB 404.23, taille de marché 6,891,165 $, 1 acteur(s).
Concurrence : HIKMA 100%.'),
    ('regpf0004', 4, 'CLADRIBINE', NULL, NULL, '10', 'MG', 'COMPRIME', 'B/01', 'Neurologie', 'HOSPITAL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : COMP 10 MG — B/01
Statut visé (feuille) : Fabrication
Marché : quantité marché PCH 6249.00, prix FOB 914.47, taille de marché 5,714,521 $, 1 acteur(s).
Concurrence : HIKMA ENREGISTREMENT Juin 2025.'),
    ('regpf0005', 5, 'CLADRIBINE', NULL, NULL, '10', 'MG', 'COMPRIME', 'B/04', 'Neurologie', 'HOSPITAL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : COMP 10 MG — B/04
Statut visé (feuille) : Fabrication
Marché : prix FOB 3655.04, 2 acteur(s).
Concurrence : HIKMA ENREGISTREMENT Juin 2026.'),
    ('regpf0006', 6, 'CLADRIBINE', NULL, NULL, '10', 'MG', 'COMPRIME', 'B/08', 'Neurologie', 'HOSPITAL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : COMP 10 MG — B/08
Statut visé (feuille) : Fabrication
Marché : prix FOB 5482.57, 3 acteur(s).
Concurrence : HIKMA ENREGISTREMENT Juin 2027.'),
    ('regpf0007', 7, 'VALPROIC ACID', NULL, 'Depakine', '200', 'MG', 'COMPRIME', 'B/40', 'Neurologie', 'BOTH', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.GASTRORE 200 MG — B/40
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 46,747, quantité marché PCH 1756.25, prix FOB 2.32, taille de marché 112,528 $, 1 acteur(s).
Concurrence : Sanofi 100%.'),
    ('regpf0008', 8, 'VALPROIC ACID', NULL, 'Depakine', '500', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'BOTH', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.PELL. LP 500 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,374,274, quantité marché PCH 19700.00, prix FOB 5.61, taille de marché 7,819,772 $, 2 acteur(s).
Concurrence : Sanofi 98 % · SOPROPHAL 2%.'),
    ('regpf0009', 9, 'VALPROIC ACID', NULL, 'Depakine', '20', 'PERCENT', 'SOLUTION_BUVABLE', 'B/1 40 ML', 'Neurologie', 'BOTH', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SOLN BUV. 20 % — B/1 40 ML
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 786,423, quantité marché PCH 406.00, prix FOB 1.36, taille de marché 1,071,756 $, 3 acteur(s).
Concurrence : Sanofi 100% · INPHA-MEDIS 0% · BIOGALENIC 0%.'),
    ('regpf0010', 10, 'LEVETIRACETAM', NULL, NULL, '250', 'MG', 'COMPRIME_PELLICULE', 'B/60', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 250 MG — B/60
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 199,732, prix FOB 9.40, taille de marché 1,877,481 $, 11 acteur(s).
Concurrence : El Kendi 94% · Beker 3% · BIOCARE 1%.'),
    ('regpf0011', 11, 'LEVETIRACETAM', NULL, NULL, '250', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 250 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 92,118, prix FOB 4.85, taille de marché 446,633 $, 3 acteur(s).
Concurrence : HIKMA 97% · TABUK 3% · ABD.IBRAH.REMED 3%.'),
    ('regpf0012', 12, 'LEVETIRACETAM', NULL, NULL, '500', 'MG', 'COMPRIME_PELLICULE', 'B/60', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 500 MG — B/60
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 301,495, prix FOB 18.31, taille de marché 5,520,373 $, 6 acteur(s).
Concurrence : El Kendi 94% · BEKER 3% · PHARMALLIANCE 2%.'),
    ('regpf0013', 13, 'LEVETIRACETAM', NULL, NULL, '500', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.PELL. LP 500 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 214,030, prix FOB 9.45, taille de marché 2,023,556 $, 4 acteur(s).
Concurrence : HIKMA 83% · El Kendi 15% · TABUK 2%.'),
    ('regpf0014', 14, 'LEVETIRACETAM', NULL, NULL, '750', 'MG', 'COMPRIME_PELLICULE', 'B/60', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.PELL.SEC 750 MG — B/60
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 27,838, prix FOB 25.63, taille de marché 713,488 $, 2 acteur(s).
Concurrence : El Kendi 90% · BIOCARE 10%.'),
    ('regpf0015', 15, 'LEVETIRACETAM', NULL, NULL, '750', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.PELL. LP 750 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 138,982, prix FOB 12.82, taille de marché 1,781,749 $, 3 acteur(s).
Concurrence : HIKMA 94% · El Kendi 6% · Biopharm 0%.'),
    ('regpf0016', 16, 'LEVETIRACETAM', NULL, NULL, '1000', 'MG', 'COMPRIME_PELLICULE', 'B/60', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 1000 MG — B/60
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 5,707, prix FOB 35.56, taille de marché 202,944 $, 2 acteur(s).
Concurrence : Biopharm 100% · ABD.IBRAH.REMED 0%.'),
    ('regpf0017', 17, 'LEVETIRACETAM', NULL, NULL, '100', 'MG_ML', 'SOLUTION_BUVABLE', 'B/1 120 ML', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SOLN BUV. 100 MG /ML — B/1 120 ML
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 112,547, prix FOB 7.77, taille de marché 873,945 $, 2 acteur(s).
Concurrence : HIKMA 76% · BIOPHARM 24%.'),
    ('regpf0018', 18, 'LEVETIRACETAM', NULL, NULL, '100', 'MG_ML', 'SOLUTION_BUVABLE', 'B/1 300 ML', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SOLN BUV. 100 MG /ML — B/1 300 ML
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 67,164, prix FOB 17.65, taille de marché 1,185,546 $, 1 acteur(s).
Concurrence : El Kendi 100%.'),
    ('regpf0019', 19, 'MIRTAZAPINE', NULL, NULL, '15', 'MG', 'COMPRIME_PELLICULE', 'B /30', 'Psychiatrie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : COMP PELL 15 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 426,030, prix FOB 2.66, taille de marché 1,134,531 $, 1 acteur(s).
Concurrence : CPCM 100%.'),
    ('regpf0020', 20, 'MIRTAZAPINE', NULL, NULL, '30', 'MG', 'COMPRIME_PELLICULE', 'B /30', 'Psychiatrie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : COMP PELL 30 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 426,030, prix FOB 6.56, taille de marché 2,795,467 $, 1 acteur(s).
Concurrence : CPCM 100%.'),
    ('regpf0021', 21, 'ALTEPLASE', NULL, NULL, '10', 'MG', 'POUDRE_INJECTABLE', 'B/1', 'Réanimation', 'HOSPITAL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : PDRE+SOLV P/SOL INJ IV ET PERF 10MG/10ML — B/1
Statut visé (feuille) : Importation
Marché : quantité marché PCH 66.00, prix FOB 58.00, taille de marché 3,828 $, 1 acteur(s).
Concurrence : GENERIUM NEXT LLC 100%.'),
    ('regpf0022', 22, 'ALTEPLASE 3M', NULL, NULL, '20', 'MG', 'SOLUTION_INJECTABLE', 'B/1', 'Réanimation', 'HOSPITAL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : INJ 20MG — B/1
Statut visé (feuille) : Importation
Marché : quantité marché PCH 600.00, prix FOB 105.00, taille de marché 63,000 $, 1 acteur(s).
Concurrence : GENERIUM NEXT LLC 100%.'),
    ('regpf0023', 23, 'ALTEPLASE 3M', NULL, NULL, '50', 'MG', 'SOLUTION_INJECTABLE', 'B/1', 'Réanimation', 'HOSPITAL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : INJ 50MG — B/1
Statut visé (feuille) : Importation
Marché : quantité marché PCH 5600.00, prix FOB 241.00, taille de marché 1,349,600 $, 1 acteur(s).
Concurrence : GENERIUM NEXT LLC 100%.'),
    ('regpf0024', 24, 'LAMOTRIGINE', NULL, NULL, '5', 'MG', 'COMPRIME', 'B /30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'LOW', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. DISPERS 5 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 70,400, prix FOB 2.23, taille de marché 156,665 $, 5 acteur(s).
Concurrence : El Kendi 82% · BEKER 18%.'),
    ('regpf0025', 25, 'LAMOTRIGINE', NULL, NULL, '25', 'MG', 'COMPRIME', 'B /30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'LOW', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. DISPERS 25 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 674,771, prix FOB 3.87, taille de marché 2,608,798 $, 5 acteur(s).
Concurrence : El Kendi 60% · HIKMA 35%.'),
    ('regpf0026', 26, 'LAMOTRIGINE', NULL, NULL, '50', 'MG', 'COMPRIME', 'B /30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'LOW', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. DISPERS 50 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 326,825, prix FOB 5.92, taille de marché 1,933,331 $, 2 acteur(s).
Concurrence : HIKMA 100% · SOPRODIUM 0%.'),
    ('regpf0027', 27, 'LAMOTRIGINE', NULL, NULL, '100', 'MG', 'COMPRIME', 'B /30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'LOW', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. DISPERS 100 MG — B /30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 743,027, prix FOB 10.35, taille de marché 7,691,899 $, 5 acteur(s).
Concurrence : El Kendi 55% · HIKMA 40% · BEKER 4%.'),
    ('regpf0028', 28, 'ROPINIROLE', NULL, NULL, '1', 'MG', 'COMPRIME_PELLICULE', 'B/20', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC.1 MG — B/20
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 379,599, prix FOB 3.53, taille de marché 1,339,289 $, 2 acteur(s).
Concurrence : El Kendi 97% · Biocare 3%.'),
    ('regpf0029', 29, 'ROPINIROLE', NULL, NULL, '2', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 2 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 37,583, prix FOB 5.92, taille de marché 222,587 $, 1 acteur(s).
Concurrence : El Kendi 100%.'),
    ('regpf0030', 30, 'ROPINIROLE', NULL, NULL, '5', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC.5 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,617, prix FOB 12.31, taille de marché 19,905 $, 1 acteur(s).
Concurrence : El Kendi 100%.'),
    ('regpf0031', 31, 'ROPINIROLE', NULL, NULL, '0.25', 'MG', 'COMPRIME_PELLICULE', 'B/20', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC 0.25 MG — B/20
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 150,068, prix FOB 1.87, taille de marché 280,809 $, 2 acteur(s).
Concurrence : El Kendi 94% · Biocare 6%.'),
    ('regpf0032', 32, 'ROPINIROLE', NULL, NULL, '4', 'MG', 'COMPRIME', 'B/30', NULL, 'BOTH', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR LP 4mg b/30 — B/30
Marché : prix FOB 7.39.'),
    ('regpf0033', 33, 'ROPINIROLE', NULL, NULL, '8', 'MG', 'COMPRIME', 'B/30', NULL, 'BOTH', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR LP 8mg b/30 — B/30
Marché : prix FOB 14.13.'),
    ('regpf0034', 34, 'ROPINIROLE', NULL, NULL, '2', 'MG', 'COMPRIME', 'B/30', NULL, 'BOTH', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR LP 2mg B/30 — B/30
Marché : prix FOB 4.82.'),
    ('regpf0035', 35, 'ENTACAPONE', NULL, NULL, '200', 'MG', 'COMPRIME_PELLICULE', 'B/30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. 200 MG — B/30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 161,879, prix FOB 13.92, taille de marché 2,252,626 $, 1 acteur(s).
Concurrence : El Kendi 100%.'),
    ('regpf0036', 36, 'RASAGILINE', NULL, NULL, '1', 'MG', 'COMPRIME', '1 MG - B/ 30', 'Neurologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. — 1 MG - B/ 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 70,804, prix FOB 27.89, taille de marché 1,975,033 $, 2 acteur(s).
Concurrence : BIOPHARM 95% · El Kendi 5%.'),
    ('regpf0037', 37, 'TRIPTORELINE', NULL, NULL, '0.1', 'PERCENT', 'POUDRE_INJECTABLE', 'O,1% - B/7 FL PDRE+AMP SOLV de 1ml', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : FL PDRE+SOLV en SC — O,1% - B/7 FL PDRE+AMP SOLV de 1ml
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 10,084, prix FOB 16.59, taille de marché 167,294 $, 1 acteur(s).
Concurrence : IPSEN 100%.'),
    ('regpf0038', 38, 'TRIPTORELINE', NULL, NULL, '11.25', 'MG', 'SOLUTION_INJECTABLE', '11,25 mg pdre/solv p susp', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SUS INJ - LP en IM — 11,25 mg pdre/solv p susp
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 66,686, prix FOB 200.82, taille de marché 13,391,616 $, 1 acteur(s).
Concurrence : IPSEN 100%.'),
    ('regpf0039', 39, 'TRIPTORELINE', NULL, NULL, '3.75', 'MG', 'POUDRE_INJECTABLE', '3.75 MG - B/1 PDRE+SOLV 2 ML', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : PDRE+SOLV SER en .IM L.P. — 3.75 MG - B/1 PDRE+SOLV 2 ML
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 120,589, prix FOB 71.72, taille de marché 8,648,643 $, 1 acteur(s).
Concurrence : IPSEN 100%.'),
    ('regpf0040', 40, 'FOSFOMYCINE', NULL, NULL, '3', 'G', 'SUSPENSION_BUVABLE', '3G / B 1', 'Gynécologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : Grannulés sachet /SUS.BV — 3G / B 1
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,568,091, prix FOB 4.15, taille de marché 6,507,578 $, 2 acteur(s).
Concurrence : Biocare (Uricare) = 98% · Onyx pharma (Uronyx) = 2%.'),
    ('regpf0041', 41, 'TAMSULOSINE', NULL, NULL, '0.4', 'MG', 'GELULE', '0,4 MG/B 30', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GELULE. LP — 0,4 MG/B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 3,114,292, prix FOB 6.68, taille de marché 20,813,120 $, 9 acteur(s).
Concurrence : El Kendi (Tamsir) = 41% · Abdi Ibrahim (Tamsumed) = 21% · Frater Razes (Prostasir) = 15%.'),
    ('regpf0042', 42, 'TAMSULOSINE', NULL, NULL, '0.4', 'MG', 'GELULE', '0,4 MG/B 90', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GELULE. LP — 0,4 MG/B 90
Statut visé (feuille) : Fabrication
Marché : prix FOB 20.05, 9 acteur(s).
Concurrence : El Kendi (Tamsir) = 41% · Abdi Ibrahim (Tamsumed) = 21% · Frater Razes (Prostasir) = 15%.'),
    ('regpf0043', 43, 'FINASTERIDE', NULL, NULL, '5', 'MG', 'COMPRIME_PELLICULE', '5 MG/B 30', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC. — 5 MG/B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,046,767, prix FOB 8.75, taille de marché 9,155,525 $, 3 acteur(s).
Concurrence : Abdi Ibrahim (Prostamed) = 85% · HAYAT (Prostacare) = 15% · Pharma Makers (Urosteride) = 0,1%.'),
    ('regpf0044', 44, 'TADALAFIL', NULL, NULL, '5', 'MG', 'COMPRIME_PELLICULE', '5 MG/B 28 - B/ 30', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 5 MG/B 28 - B/ 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 490,346, prix FOB 7.50, taille de marché 3,677,595 $, 8 acteur(s).
Concurrence : Beker (Tadalis) = 38% · Dar Al Dawa (Tyra) = 27% · Sophal (Ciafal) = 18%.'),
    ('regpf0045', 45, 'TADALAFIL', NULL, NULL, '20', 'MG', 'COMPRIME_PELLICULE', '20 MG/B 2', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 20 MG/B 2
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 385,805, prix FOB 2.87, taille de marché 1,108,510 $, 6 acteur(s).
Concurrence : Beker (Tadalis) = 92% · Inphamedis (Vitalis) = 7%.'),
    ('regpf0046', 46, 'TADALAFIL', NULL, NULL, '20', 'MG', 'COMPRIME_PELLICULE', '20 MG/B 4', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 20 MG/B 4
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 8,809, prix FOB 5.31, taille de marché 46,776 $, 6 acteur(s).
Concurrence : World Medicine (Tadafors) = 63% · El kendi (Erixium) = 20% · Tabuk (Tablafil) = 18%.'),
    ('regpf0047', 47, 'TADALAFIL', NULL, NULL, '20', 'MG', 'COMPRIME_PELLICULE', '20 MG/B 8', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 20 MG/B 8
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 165,564, prix FOB 9.99, taille de marché 1,653,984 $, 3 acteur(s).
Concurrence : Beker (Tadalis) = 96% · World Medicine (Tadafors) = 3% · Pharmalliance (Tafialys) = 1%.'),
    ('regpf0048', 48, 'TADALAFIL', NULL, NULL, '20', 'MG', 'COMPRIME_PELLICULE', '20 MG/B 10', 'Urologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 20 MG/B 10
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 4,195, prix FOB 14.65, taille de marché 61,457 $, 1 acteur(s).
Concurrence : Novomedis (Megalis) = 100%.'),
    ('regpf0049', 49, 'TAMSULOSINE + TADALAFIL', '["TAMSULOSINE","TADALAFIL"]', NULL, '0.4 mg + 5 mg', NULL, 'CAPSULE_MOLLE', '0,4 mg+5 MG/ B 30', 'Urologie', 'BOTH', 'IMPORTATION', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : Gélule ou capsule molle LP — 0,4 mg+5 MG/ B 30
Marché : quantité marché ville 311,429, prix FOB 8.75, taille de marché 2,725,004 $, NA acteur(s).
Concurrence : 1st to market combination.'),
    ('regpf0050', 50, 'ISOTRÉTINOÏNE', NULL, NULL, '5', 'MG', 'CAPSULE_MOLLE', '5 MG/ B 30', 'Dermatologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS.MOLLES — 5 MG/ B 30
Statut visé (feuille) : Importation
Marché : quantité marché ville 33,976, prix FOB 4.20, taille de marché 142,699 $, 1 acteur(s).
Concurrence : Pierre Fabre (Curacne) = 100%.'),
    ('regpf0051', 51, 'ISOTRÉTINOÏNE', NULL, NULL, '10', 'MG', 'CAPSULE_MOLLE', '10 MG,/ B 30', 'Dermatologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS.MOLLES — 10 MG,/ B 30
Statut visé (feuille) : Importation
Marché : quantité marché ville 270,642, prix FOB 3.21, taille de marché 868,761 $, 2 acteur(s).
Concurrence : Pierre Fabre (Curacne) = 50% · Hikma (Xeractan) = 50%.'),
    ('regpf0052', 52, 'ISOTRÉTINOÏNE', NULL, NULL, '20', 'MG', 'CAPSULE_MOLLE', '20 MG/ B 30', 'Dermatologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS.MOLLES — 20 MG/ B 30
Statut visé (feuille) : Importation
Marché : quantité marché ville 273,979, prix FOB 5.88, taille de marché 1,610,997 $, 2 acteur(s).
Concurrence : Pierre Fabre (Curacne) = 50% · Hikma (Xeractan) = 50%.'),
    ('regpf0053', 53, 'AZATHIOPRINE', NULL, NULL, '50', 'MG', 'COMPRIME_PELLICULE', '50 MG/ B 100', 'Oncologie', 'BOTH', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR. PELLIC — 50 MG/ B 100
Statut visé (feuille) : Importation
Marché : quantité marché ville 111,892, quantité marché PCH 12000.00, prix FOB 7.74, taille de marché 958,924 $, 2 acteur(s).
Concurrence : ASPEN 97% · VIATRIS 3%.'),
    ('regpf0054', 54, 'TACROLIMUS', NULL, NULL, NULL, NULL, 'POMMADE', 'Tube 30 G / 60 G', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : POMMADE — Tube 30 G / 60 G
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 45,000, prix FOB 15.00, taille de marché 675,000 $, NA acteur(s).
Concurrence : 1st to market.'),
    ('regpf0055', 55, 'AMOROLFINE', NULL, NULL, '5', 'PERCENT', 'AUTRE', '5 % /1 FL 2.5 ML', 'Dermatologie', 'RETAIL', 'IMPORTATION', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SOLUTION LOCALE+SPATULE OU PINCEAU APPLICATEUR — 5 % /1 FL 2.5 ML
Statut visé (feuille) : Importation Fabrication
Marché : quantité marché ville 341,008, prix FOB 10.25, taille de marché 3,496,533 $, 2 acteur(s).
Concurrence : Galderma (Loecryl) = 93% · Biorem (Bioferyl) = 7%.'),
    ('regpf0056', 56, 'CLOBETASOL', NULL, NULL, '0.5', 'PERCENT', 'CREME', '0,5% / 1 tube 15 G / 45 G', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CREME DERM. — 0,5% / 1 tube 15 G / 45 G
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,431,008, prix FOB 2.23, taille de marché 3,184,497 $, 2 acteur(s).
Concurrence : Biopharm (Clotasol) = 90% · El Kendi (Colbecort) = 10%.'),
    ('regpf0057', 57, 'CLOBETASOL', NULL, NULL, '0.5', 'PERCENT', 'POMMADE', '0,5% / 1 tube 15 G / 45 G', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : POMMAD DERM. — 0,5% / 1 tube 15 G / 45 G
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 1,219,750, prix FOB 1.95, taille de marché 2,379,371 $, 2 acteur(s).
Concurrence : Biopharm (Clotasol) = 92% · El Kendi (Colbecort) = 8%.'),
    ('regpf0058', 58, 'CLOBETASOL', NULL, NULL, '0.5', 'PERCENT', 'GEL', '0,5% / 1 tube 45 G', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : GEL DERM. — 0,5% / 1 tube 45 G
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 139,903, prix FOB 2.23, taille de marché 311,333 $, 1 acteur(s).
Concurrence : Biopharm (Clotasol) = 100%.'),
    ('regpf0059', 59, 'MINOCYCLINE OU LYMECYCLINE', NULL, NULL, '55', 'MG', 'COMPRIME', '55 MG/B 30', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.LP — 55 MG/B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 20,586, prix FOB 10.11, taille de marché 208,035 $, 1 acteur(s).
Concurrence : Hikma (Tetracne) = 100%.'),
    ('regpf0060', 60, 'MINOCYCLINE OU LYMECYCLINE', NULL, NULL, '65', 'MG', 'COMPRIME', '65 MG/B 30', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.LP — 65 MG/B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 16,768, prix FOB 10.11, taille de marché 169,451 $, 1 acteur(s).
Concurrence : Hikma (Tetracne) = 100%.'),
    ('regpf0061', 61, 'MINOCYCLINE OU LYMECYCLINE', NULL, NULL, '80', 'MG', 'COMPRIME', '80 MG /B 30', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.LP — 80 MG /B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 16,627, prix FOB 10.11, taille de marché 168,026 $, 1 acteur(s).
Concurrence : Hikma (Tetracne) = 100%.'),
    ('regpf0062', 62, 'MINOCYCLINE OU LYMECYCLINE', NULL, NULL, '105', 'MG', 'COMPRIME', '105 MG/B 30', 'Dermatologie', 'RETAIL', 'FULL_PROCESS', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.LP — 105 MG/B 30
Statut visé (feuille) : Fabrication
Marché : quantité marché ville 6,590, prix FOB 10.11, taille de marché 66,596 $, 1 acteur(s).
Concurrence : Hikma (Tetracne) = 100%.'),
    ('regpf0063', 63, 'PROGESTÉRONE', NULL, NULL, '100', 'MG', 'GELULE', '100 MG/ B 30', 'Gynécologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS — 100 MG/ B 30
Statut visé (feuille) : Importation
Marché : quantité marché ville 25,533, prix FOB 3.87, taille de marché 98,844 $, 2 acteur(s).
Concurrence : Besin (Utrogestan) = 99% · Effik (Progeva) = 1%.'),
    ('regpf0064', 64, 'PROGESTÉRONE', NULL, NULL, '200', 'MG', 'GELULE', '200 MG/ B 15', 'Gynécologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS — 200 MG/ B 15
Statut visé (feuille) : Importation
Marché : quantité marché ville 1,925,712, prix FOB 4.59, taille de marché 8,840,769 $, 2 acteur(s).
Concurrence : Besin (Utrogestan) = 81% · Effik (Progeva) = 19%.'),
    ('regpf0065', 65, 'PROGESTÉRONE', NULL, NULL, '400', 'MG', 'GELULE', '400 MG/ B 15', 'Gynécologie', 'RETAIL', 'IMPORTATION', 'HIGH', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS — 400 MG/ B 15
Statut visé (feuille) : Importation
Marché : prix FOB 7.72.
Concurrence : PHILADELPHIA.'),
    ('regpf0066', 66, 'CLINDAMYCINE + CLOTRIMAZOLE', '["CLINDAMYCINE","CLOTRIMAZOLE"]', NULL, '100', 'MG', 'OVULE', '100 mg + 100 (200) mg /B 7', 'Gynécologie', 'RETAIL', 'IMPORTATION', 'CRITICAL', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CAPS/Ovule — 100 mg + 100 (200) mg /B 7
Statut visé (feuille) : NA
Marché : quantité marché ville 337,720, prix FOB 3.57, taille de marché 1,205,046 $, 12 acteur(s).
Concurrence : Salem (Gynomix) = 32% · Innothera (Polygynax) = 27% · Salem (Ecovar) = 20%.'),
    ('regpf0067', 67, 'POSACONAZOLE', NULL, NULL, '40', 'MG_ML', 'SOLUTION_BUVABLE', '40MG/ML B/01 FL DE 105ML+UNE CUILLERE MESURE DE 2,5 ML ET 5 ML', 'Infectiologie & Réanimation', 'HOSPITAL', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : SOL BUV — 40MG/ML B/01 FL DE 105ML+UNE CUILLERE MESURE DE 2,5 ML ET 5 ML
Statut visé (feuille) : Importation
Marché : quantité marché PCH 1104.00, prix FOB 394.00, taille de marché 434,976 $, 1 acteur(s).
Concurrence : Noxafil® de MSD 100%.'),
    ('regpf0068', 68, 'POSACONAZOLE', NULL, NULL, '100', 'MG', 'COMPRIME', '100MG /B 24', 'Infectiologie & Réanimation', 'HOSPITAL', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : CPR.GASTRO RESISTANT — 100MG /B 24
Statut visé (feuille) : Importation
Marché : quantité marché PCH 1625.00, prix FOB 541.00, taille de marché 879,125 $.
Concurrence : Noxafil® de MSD 100%.'),
    ('regpf0069', 69, 'PROFERTIL', NULL, NULL, NULL, NULL, 'GELULE', 'B/ 60 - B/ 180', 'Urologie', 'RETAIL', 'IMPORTATION', 'MEDIUM', 'Importé depuis « Sélection PF Produits ».
Libellé d''origine : Capsule — B/ 60 - B/ 180
Marché : quantité marché ville 150,000.
Concurrence : Lenus pharma / NovoMedis.')
) AS v(id, idx, dci, molecules, brand, dosage, unit, form, packaging, klass, channel, mfg, prio, comments)
WHERE NOT EXISTS (SELECT 1 FROM "RegulatoryProduct" p WHERE p.id = v.id);

-- Le workflow en 17 étapes, comme pour tout dossier créé depuis l'application.
INSERT INTO "RegulatoryStep" (id, "productId", type, "order", status, "createdAt", "updatedAt")
SELECT p.id || '-s' || s.ord, p.id, s.t::"RegulatoryStepType", s.ord, 'NOT_STARTED'::"StepStatus", now(), now()
FROM "RegulatoryProduct" p
CROSS JOIN (VALUES
    ('PRE_SUBMISSION', 1),
    ('CTD_PREPARATION', 2),
    ('DOSSIER_REVIEW', 3),
    ('DOSSIER_SUBMISSION', 4),
    ('BV1_PAYMENT', 5),
    ('BV1_RECEIPT', 6),
    ('BV2_PAYMENT', 7),
    ('BV2_RECEIPT', 8),
    ('BV3_PAYMENT', 9),
    ('BV3_RECEIPT', 10),
    ('QUERY_RESPONSE', 11),
    ('COMPLEMENTS_REQUESTED', 12),
    ('COMPLEMENTS_SUBMITTED', 13),
    ('COMMISSION_REVIEW', 14),
    ('REGISTRATION_DECISION', 15),
    ('AMM_RECEIVED', 16),
    ('DOSSIER_CLOSED', 17)
) AS s(t, ord)
WHERE p.id LIKE 'regpf%'
  AND NOT EXISTS (
    SELECT 1 FROM "RegulatoryStep" x WHERE x."productId" = p.id AND x.type = s.t::"RegulatoryStepType"
  );
