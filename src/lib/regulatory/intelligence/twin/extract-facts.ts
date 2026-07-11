/**
 * EXTRACTION DÉTERMINISTE de faits réglementaires (jumeau numérique). Pas d'IA : regex +
 * mots-clés + libellés, avec **extrait exact** (preuve), **confiance** et **méthode**. Ne
 * couvre que le sous-ensemble tractable de façon fiable ; le reste relève de la revue humaine
 * / des agents IA. Pur et testable.
 */

export interface FactHit {
  factKey: string;
  rawValue: string;
  normalizedValue?: string;
  extract: string;
  confidence: number;
  method: "regex" | "keyword" | "label";
}

export interface ExtractDocInput {
  documentId: string;
  sectionCode: string | null;
  text: string;
}

export interface DocFactHit extends FactHit {
  documentId: string;
  sectionCode: string | null;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
function snippet(text: string, index: number, radius = 90): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return norm((start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""));
}

/** Valeur après un libellé (« DCI : … »), jusqu'à fin de ligne / ponctuation forte. */
function labelValue(text: string, labelRe: RegExp): { value: string; index: number } | null {
  const m = labelRe.exec(text);
  if (!m) return null;
  const after = text.slice(m.index + m[0].length);
  const val = after.split(/[\n\r.;•]|(?: {2,})/)[0];
  const cleaned = norm(val).replace(/^[:：\-–\s]+/, "").slice(0, 120);
  return cleaned.length >= 2 ? { value: cleaned, index: m.index } : null;
}

const DOSAGE_FORMS = [
  "comprimé pelliculé", "comprimé effervescent", "comprimé", "gélule", "capsule molle", "capsule",
  "sirop", "solution buvable", "solution injectable", "suspension buvable", "suspension injectable",
  "poudre pour solution", "pommade", "crème", "gel", "collyre", "suppositoire", "granulés",
  "film-coated tablet", "tablet", "hard capsule", "oral solution", "injection", "ointment", "cream",
];
const ROUTES = [
  "voie orale", "par voie orale", "per os", "voie intraveineuse", "intraveineuse", "voie intramusculaire",
  "intramusculaire", "voie sous-cutanée", "sous-cutanée", "voie cutanée", "cutanée", "ophtalmique",
  "voie nasale", "nasale", "voie rectale", "rectale", "oral use", "intravenous", "intramuscular", "subcutaneous",
];
const PACKS = [
  "plaquette", "blister", "flacon", "ampoule", "tube", "sachet", "pvc/pvdc", "pvc", "aluminium", "alu/alu",
  "boîte de", "seringue préremplie", "stylo", "vial",
];

function keywordHits(text: string, lower: string, factKey: string, terms: string[], conf: number, cap = 2): FactHit[] {
  const hits: FactHit[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx === -1) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ factKey, rawValue: norm(text.substr(idx, term.length)), extract: snippet(text, idx), confidence: conf, method: "keyword" });
    if (hits.length >= cap) break;
  }
  return hits;
}

/** Extrait les faits d'un document (texte + section). */
export function extractFactsFromText(text: string, sectionCode: string | null): FactHit[] {
  if (!text || text.length < 10) return [];
  const lower = text.toLowerCase();
  const out: FactHit[] = [];

  // Libellés (haute confiance)
  const labels: [string, RegExp][] = [
    ["INN", /\b(d\.?c\.?i\.?|substance active|principe actif|active substance|international nonproprietary name)\s*[:：]/i],
    ["PRODUCT_NAME", /\b(nom (?:commercial|du produit|de la spécialité)|dénomination|nom de marque|product name|trade name)\s*[:：]/i],
    ["APPLICANT", /\b(demandeur|applicant)\s*[:：]/i],
    ["MAH", /\b(titulaire|détenteur|marketing authorisation holder|d[ée]tenteur de la d[ée]cision)\s*[:：]/i],
    ["OPERATOR", /\b(exploitant)\s*[:：]/i],
    ["MANUFACTURER", /\b(fabricant|manufacturer|site de fabrication)\s*[:：]/i],
    ["BATCH_SIZE", /\b(taille de lot|batch size)\s*[:：]?/i],
    ["REFERENCE_PRODUCT", /\b(produit de r[ée]f[ée]rence|reference (?:product|listed drug)|princeps)\s*[:：]/i],
  ];
  for (const [key, re] of labels) {
    const lv = labelValue(text, re);
    if (lv) out.push({ factKey: key, rawValue: lv.value, extract: snippet(text, lv.index), confidence: 0.85, method: "label" });
  }

  // Dosage / teneur (regex)
  const strengthRe = /(\d+(?:[.,]\d+)?)\s?(mg\/ml|mg\/g|µg|mcg|mg|g|ml|ui|iu|%)\b/gi;
  let m: RegExpExecArray | null;
  let strengthCount = 0;
  while ((m = strengthRe.exec(text)) && strengthCount < 3) {
    const near = lower.slice(Math.max(0, m.index - 40), m.index + 40);
    const boosted = /dosage|teneur|strength|concentration/.test(near);
    out.push({
      factKey: "STRENGTH", rawValue: norm(m[0]), normalizedValue: `${m[1].replace(",", ".")} ${m[2].toLowerCase()}`,
      extract: snippet(text, m.index), confidence: boosted ? 0.75 : 0.5, method: "regex",
    });
    strengthCount++;
  }

  // Durée de conservation
  const shelfRe = /(\d+)\s?(mois|ans?|months?|years?)\b/gi;
  while ((m = shelfRe.exec(text))) {
    const near = lower.slice(Math.max(0, m.index - 60), m.index + 20);
    if (/conservation|p[ée]remption|shelf life|dur[ée]e de vie|validity/.test(near)) {
      out.push({ factKey: "SHELF_LIFE", rawValue: norm(m[0]), extract: snippet(text, m.index), confidence: 0.8, method: "regex" });
      break;
    }
  }

  // Conditions de conservation (température)
  const tempRe = /(conserver|à conserver|stocker|store|ne pas (?:dépasser|conserver au-del[àa]))[^.\n]{0,60}?(\d{1,2}\s?°?\s?c)/i;
  const tm = tempRe.exec(text);
  if (tm) out.push({ factKey: "STORAGE", rawValue: norm(tm[0]).slice(0, 120), extract: snippet(text, tm.index), confidence: 0.7, method: "regex" });

  // CPP / GMP (numéro à proximité)
  for (const [key, re] of [
    ["CPP", /(certificat de produit pharmaceutique|\bcpp\b|certificate of pharmaceutical product)[^\n]{0,40}?(n[°o]\s*[:\-]?\s*[\w\-/.]+)/i],
    ["GMP", /(\bbpf\b|\bgmp\b|bonnes pratiques de fabrication|good manufacturing practice)[^\n]{0,40}?(n[°o]\s*[:\-]?\s*[\w\-/.]+)/i],
  ] as [string, RegExp][]) {
    const cm = re.exec(text);
    if (cm) out.push({ factKey: key, rawValue: norm(cm[2] ?? cm[0]).slice(0, 60), extract: snippet(text, cm.index), confidence: 0.75, method: "regex" });
  }

  // Formes / voies / conditionnement (mots-clés)
  out.push(...keywordHits(text, lower, "DOSAGE_FORM", DOSAGE_FORMS, 0.7, 1));
  out.push(...keywordHits(text, lower, "ROUTE", ROUTES, 0.7, 1));
  out.push(...keywordHits(text, lower, "PACKAGING", PACKS, 0.6, 2));

  void sectionCode;
  return out;
}

/** Extrait les faits de plusieurs documents (avec provenance). */
export function extractFactsFromDocuments(docs: ExtractDocInput[]): DocFactHit[] {
  const all: DocFactHit[] = [];
  for (const d of docs) {
    for (const hit of extractFactsFromText(d.text, d.sectionCode)) {
      all.push({ ...hit, documentId: d.documentId, sectionCode: d.sectionCode });
    }
  }
  return all;
}
