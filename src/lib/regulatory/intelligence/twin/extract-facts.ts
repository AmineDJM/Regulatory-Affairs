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
  method: "regex" | "keyword" | "label" | "ai";
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

/**
 * Contexte LOCAL d'une occurrence, BORNÉ À SA PHRASE : on part de `[idx-radius, idx+len+radius]`
 * puis on coupe à la première frontière forte (« . », « ; », « : », saut de ligne) de part et
 * d'autre. Essentiel : un « –70 °C » d'échantillons dans la phrase PRÉCÉDENTE ne doit pas
 * disqualifier la conservation du produit de la phrase COURANTE (et inversement pour la voie).
 */
function localCtx(lower: string, idx: number, len: number, radius: number): string {
  const from = Math.max(0, idx - radius);
  const to = Math.min(lower.length, idx + len + radius);
  let start = from;
  for (let i = idx - 1; i >= from; i--) {
    const c = lower[i];
    if (c === "." || c === ";" || c === ":" || c === "\n" || c === "\r") { start = i + 1; break; }
  }
  let end = to;
  for (let i = idx + len; i < to; i++) {
    const c = lower[i];
    if (c === "." || c === ";" || c === ":" || c === "\n" || c === "\r") { end = i; break; }
  }
  return lower.slice(start, end);
}

// ─────────────── Association de teneurs (« 600 mg / 300 mg / 50 mg ») ───────────────

/** Lien EXPLICITE entre deux doses d'une association (« and », « / », « + », « contient »…). */
const COMBO_LINK = /\band\b|\bet\b|\/|\+|&|contain|contient|associ|\bplus\b/i;
/** Mots de POSOLOGIE dans le trou → jamais une association (« 50 mg, sans dépasser 300 mg »). */
const COMBO_STOP = /\b(max\w*|min\w*|sans|d[ée]pass\w*|jusqu\w*|puis|then|exceed\w*|toutes?|every|jours?|daily|day|doses?|prendre|posologie|apr[èe]s|before|after)\b/i;
/**
 * VIRGULE-LIEN : dans un TITRE de dossier (« ABACAVIR 600MG, LAMIVUDINE 300MG & DOLUTEGRAVIR
 * 50MG »), les composants ne sont séparés que par « , Molécule » — un à deux mots de lettres,
 * rien d'autre. Sans cette règle, l'association COMPLÈTE du produit ne matchait jamais et la
 * paire narrative d'un comparateur gagnait par défaut.
 */
const COMBO_COMMA = /^,\s*(?:de\s+|d['’]\s*)?\p{L}[\p{L}\p{N}'’-]{2,}(?:\s+\p{L}[\p{L}\p{N}'’-]{2,})?\s*$/u;

function comboLinkOk(gap: string): boolean {
  if (COMBO_STOP.test(gap)) return false;
  if (COMBO_LINK.test(gap)) return true;
  return COMBO_COMMA.test(gap.trim());
}

/**
 * LA meilleure association de teneurs du texte — et non la première venue. Le PLUS de composants
 * gagne : sur une trithérapie, la paire « 600 mg and 300 mg » citée par l'étude clinique est le
 * COMPARATEUR bithérapie (Epzicom/Kivexa), pas le produit ; l'association complète « 600MG,
 * LAMIVUDINE 300MG & DOLUTEGRAVIR 50MG » doit l'emporter. Un contexte de comparateur
 * (« respectively », « separate tablet », « versus ») pénalise en plus la confiance.
 */
function bestStrengthCombo(text: string, lower: string): FactHit | null {
  const tokRe = /(\d+(?:[.,]\d+)?)\s?mg\b/giu;
  const toks: { value: string; index: number; end: number }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tokRe.exec(text)) !== null && toks.length < 400) {
    toks.push({ value: tm[1], index: tm.index, end: tm.index + tm[0].length });
  }

  let best: { start: number; end: number; values: string[]; confidence: number } | null = null;
  let i = 0;
  while (i < toks.length) {
    const values = [toks[i].value];
    let j = i;
    while (j + 1 < toks.length && values.length < 4) {
      const gap = text.slice(toks[j].end, toks[j + 1].index);
      if (gap.length > 60 || !comboLinkOk(gap)) break;
      values.push(toks[j + 1].value);
      j++;
    }
    if (values.length >= 2) {
      const ctx = lower.slice(Math.max(0, toks[i].index - 90), Math.min(lower.length, toks[j].end + 90));
      const comparator = /respectively|respectivement|separate (?:tablet|capsule)|comprim[ée]s? s[ée]par[ée]|comparat|versus|\bvs\b/.test(ctx);
      const confidence = Math.max(0.3, (values.length >= 3 ? 0.9 : 0.88) - (comparator ? 0.18 : 0));
      // Composants d'abord (10 points l'unité), confiance ensuite : 3 composants à 0,72 battent
      // toujours 2 composants à 0,88 — c'est le produit qu'on cherche, pas la citation.
      const better = !best || values.length * 10 + confidence > best.values.length * 10 + best.confidence;
      if (better) best = { start: toks[i].index, end: toks[j].end, values, confidence };
    }
    i = j + 1;
  }

  if (!best) return null;
  return {
    factKey: "STRENGTH",
    rawValue: norm(text.slice(best.start, best.end)).slice(0, 80),
    normalizedValue: best.values.map((v) => `${v.replace(",", ".")} mg`).join(" / "),
    extract: snippet(text, best.start),
    confidence: best.confidence,
    method: "regex",
  };
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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Contextes DISQUALIFIANTS (le fait provient d'un passage non pertinent → ignoré) et PERTINENTS
// (le fait est bien celui du produit → +confiance). Corrige les faux positifs réels observés :
// « Intravenous » venant d'une canule d'étude PK, « ≤ –70 °C » d'un stockage d'échantillons, etc.
const CTX = {
  routeNeg: /canule|cannula|indwelling|pr[ée]l[èe]vement|blood sampl|sampling|pharmacocin|pharmacokinetic|\bpk\b|perfus|infusion|cath[ée]ter|catheter/i,
  routePos: /voie d'administration|method of administration|mode d'administration|posologie|posology|administered|orally|par voie|to be taken|à prendre|rcp|smpc/i,
  formNeg: /g[ée]latine|gelatin|gavage|\banimal|non[-\s]?clinical|non[-\s]?clinique|purity|excipient|placebo/i,
  formPos: /produit fini|drug product|forme pharmaceutique|dosage form|pellicul|film[-\s]?coated|comprim|tablet|posologie|rcp|smpc/i,
  packNeg: /test[-\s]?tube|centrifug|eppendorf|[ée]chantillon|\bsampl|blood|mobile phase|hplc|vial.{0,15}(inject|sampl|hplc)/i,
  packPos: /conditionnement|packaging|primary pack|plaquette|blister|bo[îi]te|présentation/i,
  storeNeg: /[ée]chantillon|\bsampl|aliquot|plasma|s[ée]rum|bioanalyt|below\s*-|-\s?[2-8]0\s?°?\s?c|cong[ée]l|freezer/i,
  storePos: /conserver|à conserver|ne pas dépasser|store (?:below|at|in)|shelf life|produit fini|drug product/i,
};

/**
 * Faits par mot-clé, CONTEXTUALISÉS. Recherche par MOT ENTIER (frontières unicode) — « gel » ne
 * matche plus « angel », « tube » ne matche plus au milieu d'un mot. Un contexte `negative` autour
 * de l'occurrence la fait ignorer ; un contexte `positive` augmente la confiance. On garde, par terme,
 * la MEILLEURE occurrence (contexte le plus favorable) → la valeur canonique écarte le bruit.
 */
function keywordFacts(
  text: string, lower: string, factKey: string, terms: string[],
  opts: { conf: number; cap: number; positive?: RegExp; negative?: RegExp },
): FactHit[] {
  const hits: FactHit[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, "giu");
    let m: RegExpExecArray | null;
    let best: FactHit | null = null;
    let scanned = 0;
    while ((m = re.exec(text)) !== null && scanned < 300) {
      scanned++;
      const ctx = localCtx(lower, m.index, term.length, 80);
      if (opts.negative && opts.negative.test(ctx)) continue; // occurrence hors-sujet → ignorée
      const conf = Math.min(0.9, opts.conf + (opts.positive && opts.positive.test(ctx) ? 0.15 : 0));
      if (!best || conf > best.confidence) {
        best = { factKey, rawValue: norm(text.slice(m.index, m.index + term.length)), extract: snippet(text, m.index), confidence: conf, method: "keyword" };
      }
    }
    if (best) { seen.add(key); hits.push(best); if (hits.length >= opts.cap) break; }
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

  // Dosage / teneur — COMBINAISON d'abord (« 50 mg / 300 mg », « 600MG, LAMIVUDINE 300MG &
  // DOLUTEGRAVIR 50MG ») : très fréquent pour les associations, plus fiable qu'une teneur isolée.
  // On balaie TOUTES les associations du texte et on garde LA MEILLEURE — le PLUS de composants
  // d'abord : sur une trithérapie, « 600 mg and 300 mg » n'est pas le produit, c'est le
  // comparateur bithérapie cité par l'étude clinique (Epzicom), et c'est exactement l'erreur
  // qu'on a vue à l'écran (proposé « 600 mg and 300 mg » contre des sources « 600MG, 300MG &
  // 50MG »). Un contexte de comparateur (« respectively », « separate tablet », « versus »)
  // pénalise en plus la confiance.
  let m: RegExpExecArray | null;
  const combo = bestStrengthCombo(text, lower);
  if (combo) out.push(combo);
  // Teneur isolée (regex).
  const strengthRe = /(\d+(?:[.,]\d+)?)\s?(mg\/ml|mg\/g|µg|mcg|mg|g|ml|ui|iu|%)\b/gi;
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

  // Conditions de conservation (température) — on IGNORE le stockage d'ÉCHANTILLONS (≤ –70/–80 °C,
  // plasma, bioanalytique) qui n'est PAS la conservation du produit. On garde la meilleure occurrence.
  const tempRe = /(conserver|à conserver|stocker|store)[^.\n]{0,60}?(-?\s?\d{1,2}\s?°?\s?c)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tempRe.exec(text)) !== null) {
    const ctx = localCtx(lower, tm.index, tm[0].length, 40);
    if (CTX.storeNeg.test(ctx)) continue; // stockage d'échantillons/congélateur → pas le produit
    out.push({ factKey: "STORAGE", rawValue: norm(tm[0]).slice(0, 120), extract: snippet(text, tm.index), confidence: CTX.storePos.test(ctx) ? 0.8 : 0.65, method: "regex" });
    break;
  }

  // CPP / GMP (numéro à proximité)
  for (const [key, re] of [
    ["CPP", /(certificat de produit pharmaceutique|\bcpp\b|certificate of pharmaceutical product)[^\n]{0,40}?(n[°o]\s*[:\-]?\s*[\w\-/.]+)/i],
    ["GMP", /(\bbpf\b|\bgmp\b|bonnes pratiques de fabrication|good manufacturing practice)[^\n]{0,40}?(n[°o]\s*[:\-]?\s*[\w\-/.]+)/i],
  ] as [string, RegExp][]) {
    const cm = re.exec(text);
    if (cm) out.push({ factKey: key, rawValue: norm(cm[2] ?? cm[0]).slice(0, 60), extract: snippet(text, cm.index), confidence: 0.75, method: "regex" });
  }

  // Formes / voies / conditionnement (mots-clés CONTEXTUALISÉS — mot entier + contexte pertinent).
  out.push(...keywordFacts(text, lower, "DOSAGE_FORM", DOSAGE_FORMS, { conf: 0.7, cap: 1, positive: CTX.formPos, negative: CTX.formNeg }));
  out.push(...keywordFacts(text, lower, "ROUTE", ROUTES, { conf: 0.7, cap: 1, positive: CTX.routePos, negative: CTX.routeNeg }));
  out.push(...keywordFacts(text, lower, "PACKAGING", PACKS, { conf: 0.6, cap: 2, positive: CTX.packPos, negative: CTX.packNeg }));

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
