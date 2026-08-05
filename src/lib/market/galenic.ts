/**
 * NORMALISATIONS PHARMA — molécule, dosage, forme galénique, laboratoire.
 *
 * Ces fonctions sont le PONT entre trois sources qui n'écrivent rien pareil : IQVIA (anglais,
 * présentations abrégées), les réceptions PCH (français, dosage dans le texte) et la
 * Nomenclature (structurée, avec les sels). Sans elles, les trois marchés restent trois silos.
 *
 * ⚠️ Module PUR, volontairement : il n'importe QUE `./text` et jamais `./data`. Il est chargé
 * par des composants CLIENT (l'explorateur de produits a besoin de la liste des formes), et
 * `data.ts` lit des fichiers avec `fs`/`zlib` — un seul chemin d'import vers lui suffit à
 * casser la compilation navigateur (« Module not found: Can't resolve 'fs' »).
 *
 * L'analyse de marché qui EXPLOITE ces normalisations vit dans `molecule.ts` (côté serveur).
 */
import { normText } from "./text";

// ───────────────────────────── Normalisations ─────────────────────────────

/**
 * Mots qui décrivent le SEL ou l'état d'hydratation, pas la molécule : « AMOXICILLINE
 * SODIQUE », « CÉTIRIZINE DICHLORHYDRATE » désignent la même molécule que la forme nue.
 * On les retire avant de comparer.
 */
const SALT_WORDS = [
  "SODIQUE", "SODIUM", "POTASSIQUE", "POTASSIUM", "CALCIQUE", "CALCIUM", "MAGNESIUM",
  "CHLORHYDRATE", "DICHLORHYDRATE", "HYDROCHLORIDE", "BROMHYDRATE", "SULFATE", "PHOSPHATE",
  "MALEATE", "TARTRATE", "CITRATE", "ACETATE", "SUCCINATE", "FUMARATE", "MESILATE", "MESYLATE",
  "BESILATE", "NITRATE", "OXALATE", "LACTATE", "GLUCONATE", "STEARATE", "PAMOATE", "VALERATE",
  "PROPIONATE", "DIPROPIONATE", "FUROATE", "TRIHYDRATE", "TRIHYDRATEE", "MONOHYDRATE",
  "ANHYDRE", "HYDRATE", "HEMIHYDRATE", "MICRONISE", "MICRONISEE",
  "EXPRIME", "EXPRIMEE", "EN", "SOUS", "FORME", "DE", "DU", "LA", "LE",
];

/**
 * Radical comparable d'une molécule. On enlève les sels, puis on coupe le « E » final
 * français : c'est ce qui rapproche l'anglais d'IQVIA (« AMOXICILLIN ») du français de la
 * nomenclature (« AMOXICILLINE »).
 */
export function moleculeStem(raw: string | null | undefined): string {
  const words = normText(raw)
    .split(" ")
    .filter((w) => w.length > 2 && !SALT_WORDS.includes(w) && !/^\d/.test(w));
  if (words.length === 0) return "";
  // On garde tous les principes actifs (les associations comptent), radical par radical.
  return words.map((w) => w.replace(/E$/, "")).join(" ");
}

/** Une molécule de la requête correspond-elle à celle d'une ligne ? (comparaison par radical) */
export function moleculeMatches(rowMolecule: string | null | undefined, query: string): boolean {
  const q = moleculeStem(query);
  if (q.length < 3) return false;
  const stem = moleculeStem(rowMolecule);
  if (!stem) return false;
  // Chaque mot demandé doit se retrouver dans la ligne (association = plusieurs mots).
  return q.split(" ").every((w) => stem.split(" ").some((s) => s.startsWith(w) || w.startsWith(s)));
}

/** Formes galéniques canoniques — le vocabulaire commun aux trois sources. */
export const GALENIC_FORMS = [
  "COMPRIME", "GELULE", "SIROP", "INJECTABLE", "PERFUSION", "SACHET", "SUPPOSITOIRE",
  "COLLYRE", "POMMADE", "SPRAY", "GOUTTES", "OVULE", "PATCH", "DISPOSITIF", "AUTRE",
] as const;
export type GalenicForm = (typeof GALENIC_FORMS)[number];

export const FORM_LABEL: Record<GalenicForm, string> = {
  COMPRIME: "Comprimé", GELULE: "Gélule", SIROP: "Sirop / suspension buvable",
  INJECTABLE: "Injectable", PERFUSION: "Perfusion", SACHET: "Sachet / granulé",
  SUPPOSITOIRE: "Suppositoire", COLLYRE: "Collyre / ophtalmique", POMMADE: "Pommade / crème",
  SPRAY: "Spray / inhalation", GOUTTES: "Gouttes", OVULE: "Ovule",
  PATCH: "Patch", DISPOSITIF: "Dispositif médical", AUTRE: "Autre",
};

/**
 * Règles de reconnaissance de la forme, **dans l'ordre** — le premier motif qui accroche gagne.
 * L'ordre est la règle métier : « GELULE » avant « GEL » (un gel dermique n'est pas une gélule),
 * « PERFUSION » avant « INJECTABLE », et les dispositifs (bandelettes, lecteurs) en tête pour ne
 * pas être happés par une règle de forme.
 *
 * Les motifs abrégés viennent des présentations IQVIA réelles (« PD.SAC », « P/SUS », « FL+SOLV »,
 * « STYL PRE REM »…), les motifs en clair de la nomenclature et des réceptions PCH.
 */
const FORM_RULES: [GalenicForm, RegExp][] = [
  ["DISPOSITIF", /\b(BANDELETTE|LECTEUR|GLUCOMETRE|AUTOPIQUEUR|LANCETTE|CATHETER|SONDE|PANSEMENT ADH|COMPRESSE|SERINGUE VIDE|AIGUILLE)/],
  ["PATCH", /\b(PATCH|TRANSDERM|PANS TRANSDE|DISP.TRANSD)/],
  ["COLLYRE", /\b(COLLYRE|COLYR|OPHTALM|OPHT|GTTES OPH|GTT.OPH)/],
  ["OVULE", /\b(OVULE|VAGINAL|COMPR.VAG|CAPS.VAG)/],
  ["SUPPOSITOIRE", /\b(SUPPOSITOIRE|SUPPO|SUPP|SUP AD|SUP ENF|SUP NOU)/],
  ["SPRAY", /\b(SPRAY|SPR|AEROSOL|AER\.|PULVERIS|INHALAT|INH|NEBULIS|TURBUHAL|DISKUS|NASA|BUC DOSE)/],
  ["GELULE", /\b(GELULE|GELUL|GELU|CAPSULE|CAPS)/],
  ["PERFUSION", /\b(PERFUSION|PERF|P\.PERF)/],
  // Les stylos, seringues préremplies et implants sont des injectables — c'est ainsi qu'ils
  // s'achètent et se comparent (insulines, anticoagulants, GLP-1…).
  ["INJECTABLE", /\b(INJECTABLE|INJ|AMPOULE|AMP|SERINGUE|SER |SER\.|STYL|STYLO|FLEXPEN|KWIKPEN|SOLOSTAR|PREREMPL|PRE REM|PREMP|PR FI PE|IMPLANT|LYOPH|FL SOLV|FL\.SOLV|FL\.POUDRE|SOLV|I\.V|I\.M|S\.C)/],
  ["SACHET", /\b(SACHET|SAC|SACH|GRANULE|GRA\.|PD\.SAC|SOLU\.SAC|SOL\.SA)/],
  // Poudre pour suspension / solution buvable : la famille la plus fournie en abréviations.
  ["SIROP", /\b(SIROP|SIR|SUSPENSION|SUSP|SUS|BUVABLE|BUV|S BU|SOLN BUV|PDR PR S|P SUS|PP S|P\.S|PD\.SU|PDR\.SUS|PDR SIR|SP\b)/],
  ["GOUTTES", /\b(GOUTTE|GTTES|GTT)/],
  ["POMMADE", /\b(POMMADE|PDE|CREME|CRE\b|ONGUENT|LOTION|BAUME|SHAMPOO|SHAMPO|DERMIQ|GEL DERM|GEL\b|EMULSION)/],
  ["COMPRIME", /\b(COMPRIME|COMPR|CPR|CP|COMP|DRAGEE|DISPERS|EFFERV|SUBLING|ORODISP)/],
];

/** Ramène n'importe quelle écriture de forme à sa famille (voir `FORM_RULES`). */
export function canonicalForm(raw: string | null | undefined): GalenicForm {
  const t = normText(raw);
  if (!t) return "AUTRE";
  // La forme est TOUJOURS en tête de la présentation, avant le dosage : on ne teste que
  // cette tête, sinon « 500 MG SACHET DE 12 » ferait basculer un comprimé en sachet.
  const head = t.split(/\s(?=\d)/)[0] || t;
  for (const [form, re] of FORM_RULES) {
    if (re.test(head)) return form;
  }
  // Repli : certains libellés (PCH, nomenclature) écrivent la forme APRÈS le dosage.
  for (const [form, re] of FORM_RULES) {
    if (re.test(t)) return form;
  }
  return "AUTRE";
}

/**
 * Extrait le dosage d'un libellé : « CP.PE 875MG/ 125 MG 10 » → « 875MG/125MG ».
 * Les associations (amoxicilline + acide clavulanique) donnent deux valeurs, jointes par « / ».
 * Renvoie null si aucun dosage lisible — on préfère ne rien dire à inventer.
 */
export function extractDosage(raw: string | null | undefined): string | null {
  const t = normText(raw);
  if (!t) return null;
  // Nombre + unité (MG, G, ML, UI, %, MCG/UG) — avec ou sans espace.
  const found = t.match(/(\d+(?:[.,]\d+)?)\s?(MG|MCG|UG|G|ML|UI|%)\b/g);
  if (!found || found.length === 0) return null;
  const parts = found
    .slice(0, 3) // au-delà, c'est du conditionnement, pas du dosage
    .map((m) => m.replace(/\s+/g, "").replace(",", "."));
  // Dédoublonnage en gardant l'ordre.
  return [...new Set(parts)].join("/");
}

/** Deux dosages désignent-ils la même chose ? (« 500 mg » ≡ « 500MG ») */
export function dosageMatches(rowDosage: string | null, query: string): boolean {
  const q = extractDosage(query);
  if (!q) return true; // pas de dosage demandé → on n'exclut rien
  if (!rowDosage) return false;
  const qs = q.split("/");
  const rs = rowDosage.split("/");
  return qs.every((x) => rs.includes(x));
}
