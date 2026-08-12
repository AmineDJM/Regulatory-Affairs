/**
 * GÉNÉRATEUR de la migration d'import « Sélection PF Produits ».
 *
 * Lit le classeur versionné dans `data/`, applique les règles de `src/lib/regulatory/sheet-import.ts`
 * (module pur, testé) et écrit une migration SQL idempotente. Le SQL est committé : c'est lui qui
 * s'exécute au déploiement, pas ce script — mais le script reste dans le dépôt pour que l'import
 * soit VÉRIFIABLE et rejouable si la feuille évolue.
 *
 *   npx tsx scripts/gen-selection-pf-migration.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { REGULATORY_STEP_ORDER } from "../src/lib/labels";
import { isProductRow, mapSheetRow, type SheetProductRow } from "../src/lib/regulatory/sheet-import";

const WORKBOOK = path.join(__dirname, "..", "data", "selection-pf-produits.xlsx");
const SOURCE_LABEL = "Sélection PF Produits";
const MIGRATION = path.join(__dirname, "..", "prisma", "migrations", "20260812110000_selection_pf_products", "migration.sql");
/** Préfixe d'identifiant : rend le lot repérable en base et l'insertion rejouable sans doublon. */
const ID_PREFIX = "regpf";

/** Échappement SQL d'un littéral texte. NULL est une valeur, pas une chaîne vide. */
const q = (v: string | null): string => (v === null || v === "" ? "NULL" : `'${v.replace(/'/g, "''")}'`);

function readRows(): SheetProductRow[] {
  const wb = XLSX.readFile(WORKBOOK);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
  // Ligne 0 = totaux, ligne 1 = en-têtes, les produits commencent ensuite.
  return grid.slice(2).map((r) => ({
    specialty: r[0] ?? "", prioritization: r[1] ?? "", product: r[2] ?? "", form: r[3] ?? "",
    packaging: r[4] ?? "", commercialization: r[5] ?? "", status: r[6] ?? "",
    qtyCity: r[7] ?? "", qtyPch: r[8] ?? "", fobPrice: r[9] ?? "", marketSize: r[10] ?? "",
    actors: r[11] ?? "", n1: r[12] ?? "", n2: r[13] ?? "", n3: r[14] ?? "",
  })).filter(isProductRow);
}

function build(): string {
  const rows = readRows();
  const values = rows.map((row, i) => {
    const m = mapSheetRow(row, SOURCE_LABEL);
    const id = `${ID_PREFIX}${String(i + 1).padStart(4, "0")}`;
    const molecules = m.molecules ? q(JSON.stringify(m.molecules)) : "NULL";
    return `    (${q(id)}, ${i + 1}, ${q(m.dci)}, ${molecules}, ${q(m.brandName)}, ${q(m.dosage)}, ${q(m.dosageUnit)}, ` +
      `${q(m.pharmaceuticalForm)}, ${q(m.packaging)}, ${q(m.therapeuticClass)}, ${q(m.channel)}, ` +
      `${q(m.manufacturingStatus)}, ${q(m.priority)}, ${q(m.comments)})`;
  });

  const steps = REGULATORY_STEP_ORDER.map((t, i) => `    ('${t}', ${i + 1})`).join(",\n");

  return `-- Import du portefeuille « ${SOURCE_LABEL} » (${rows.length} produits) dans Regulatory.
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
-- IDEMPOTENT : chaque produit porte un identifiant stable « ${ID_PREFIX}NNNN » et n'est inséré
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
${values.join(",\n")}
) AS v(id, idx, dci, molecules, brand, dosage, unit, form, packaging, klass, channel, mfg, prio, comments)
WHERE NOT EXISTS (SELECT 1 FROM "RegulatoryProduct" p WHERE p.id = v.id);

-- Le workflow en ${REGULATORY_STEP_ORDER.length} étapes, comme pour tout dossier créé depuis l'application.
INSERT INTO "RegulatoryStep" (id, "productId", type, "order", status, "createdAt", "updatedAt")
SELECT p.id || '-s' || s.ord, p.id, s.t::"RegulatoryStepType", s.ord, 'NOT_STARTED'::"StepStatus", now(), now()
FROM "RegulatoryProduct" p
CROSS JOIN (VALUES
${steps}
) AS s(t, ord)
WHERE p.id LIKE '${ID_PREFIX}%'
  AND NOT EXISTS (
    SELECT 1 FROM "RegulatoryStep" x WHERE x."productId" = p.id AND x.type = s.t::"RegulatoryStepType"
  );
`;
}

const sql = build();
fs.mkdirSync(path.dirname(MIGRATION), { recursive: true });
fs.writeFileSync(MIGRATION, sql, "utf8");
console.log(`Migration écrite : ${path.relative(process.cwd(), MIGRATION)} (${sql.length} octets)`);
