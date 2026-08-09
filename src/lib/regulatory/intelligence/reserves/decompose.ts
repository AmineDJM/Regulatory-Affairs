/**
 * DÉCOMPOSITION DES RÉSERVES ANPP (G9) — découpe le texte VERBATIM d'une lettre de réserves
 * (océrisé) en POINTS + catégorisation + STRUCTURE de la lettre. Déterministe et pur.
 * Chaque point conserve l'extrait EXACT (aucune reformulation).
 *
 * LES TROIS TYPES DE RÉSERVES ANPP (constatés sur nos lettres réelles) :
 *   • TECHNICO_REGLEMENTAIRE — module 1 : pièces administratives, certificats, RCP/notice,
 *     étiquetage, légalisation ;
 *   • QC — rare : le contrôle qualité que l'agence effectue SUR PLACE (échantillons, lots),
 *     pas le dossier ;
 *   • EVALUATION_SCIENTIFIQUE — les plus nombreuses et massives : modules 3 et 5, fond ET
 *     forme (caractérisation, impuretés, validation analytique, stabilité, bioéquivalence…).
 *
 * STRUCTURE RÉELLE d'une lettre d'évaluation scientifique (ex. 92 réserves sur une trithérapie) :
 * des EN-TÊTES de section CTD (« 3.2.S.4.3. Validation des Procédures analytiques : ») sous un
 * SUJET (« LAMIVUDINE », « Produit fini »), puis des points en tirets. Sans reporter section et
 * sujet sur chaque point, « compléter les données de stabilité » ne dit pas de quelle substance
 * il s'agit — et le point est inexploitable pour y répondre.
 */

export type ReserveType = "TECHNICO_REGLEMENTAIRE" | "QC" | "EVALUATION_SCIENTIFIQUE";

export interface ReservePoint {
  ordinal: number;
  category: string;
  verbatim: string;
  /** Section CTD de l'en-tête englobant (ex. « 3.2.S.4.3 ») — reprise de la lettre, jamais inventée. */
  sectionCode: string | null;
  /** Sujet de l'en-tête englobant, verbatim (ex. « LAMIVUDINE », « Produit fini »). */
  subject: string | null;
}

// En-têtes de point : "1.", "1)", "Réserve 1", "Point 3", "- ", "•".
const POINT_RE = /^\s*(?:(?:r[ée]serve|point|observation|remarque)\s*(?:n[°o]\s*)?\d+|\d+[.)]|[-•*])\s*[:.\-)]?\s*/i;

// Code de section CTD en tête de ligne : « 3.2.S.3 », « 3.2. S.4.3 » (l'OCR insère des espaces),
// « 3.2.P.8.1 », « 5.3.1 ». Au moins DEUX sous-niveaux : « 3.2 » seul est trop ambigu — un point
// de réserve peut très bien commencer par « 3.2 est absent… ».
const SECTION_RE = /^\s*((?:[1-5])(?:\s*\.\s*(?:[0-9]+|[APSRE])){2,})\s*[.:)-]?\s*(.{0,80})$/i;

/**
 * La ligne est-elle un EN-TÊTE de section (et non un point qui commence par un code) ?
 * Un en-tête réel est un code + un court intitulé, généralement clos par « : » — jamais une
 * phrase. « 3.2.S.3. Caractérisation : » est un en-tête ; « 3.2.1 est absent du dossier. » est
 * un point. L'ambiguïté vient de ce que les deux commencent par un chiffre.
 */
function asSectionHeader(line: string): string | null {
  const m = SECTION_RE.exec(line);
  if (!m) return null;
  const rest = (m[2] ?? "").trim();
  if (rest === "" || rest.endsWith(":")) return m[1];
  if (rest.length <= 45 && !/[.!?]$/.test(rest)) return m[1];
  return null;
}

// Sujet englobant : ligne courte en capitales (« ABACAVIR SULFATE »), ou libellés usuels des lettres.
const SUBJECT_RE = /^\s*(?:substance active\s*:?\s*)?([A-ZÀ-Ü][A-ZÀ-Ü\s/+-]{2,60})\s*:?\s*$|^\s*(produit fini|finished product|module\s*[1-5](?:\s*[–—-].{0,60})?)\s*:?\s*$/i;

const CATEGORIES: { cat: string; kws: RegExp }[] = [
  { cat: "QUALITÉ", kws: /qualit|cmc|fabricat|proc[ée]d[ée]|sp[ée]cification|impuret|excipient|principe actif|substance active|caract[ée]risation|polymorphism|isom[ée]r|dmf/i },
  { cat: "STABILITÉ", kws: /stabilit|conservation|p[ée]remption|dur[ée]e de vie|zone climatique/i },
  { cat: "ANALYTIQUE", kws: /m[ée]thode|validation analytique|dosage|hplc|clhp|analyse|chromatogramme|lod|loq|solvants r[ée]siduels/i },
  { cat: "CLINIQUE", kws: /clinique|efficacit|innocuit|indication|posologie|bio[ée]quivalence|pharmacocin[ée]t/i },
  { cat: "ÉTIQUETAGE", kws: /[ée]tiquet|notice|rcp|conditionnement|mentions/i },
  { cat: "ADMINISTRATIF", kws: /administrat|formulaire|certificat|cpp|gmp|libre vente|l[ée]galis|signature|droit/i },
];

export function categorizeReserve(text: string): string {
  for (const c of CATEGORIES) if (c.kws.test(text)) return c.cat;
  return "AUTRE";
}

// Signaux par type — on COMPTE les occurrences dans toute la lettre et la majorité l'emporte.
// Un seul mot-clé ne suffit pas : une lettre d'évaluation scientifique cite souvent un certificat
// au passage sans être pour autant technico-réglementaire.
const TYPE_SIGNALS: { type: ReserveType; res: RegExp[] }[] = [
  {
    type: "EVALUATION_SCIENTIFIQUE",
    res: [
      /3\s*\.\s*2\s*\.\s*[SP]/gi, // sections 3.2.S / 3.2.P — la signature la plus fiable
      /module\s*[35]\b/gi,
      /bio[ée]quivalence|pharmacocin[ée]t/gi,
      /impuret|polymorphism|isom[ée]r|nitrosamine|g[ée]notox/gi,
      /validation.{0,30}(m[ée]thode|analytiq)|lod\b|loq\b|chromatogramme/gi,
      /stabilit[ée]|solvants r[ée]siduels|dissolution|sp[ée]cification/gi,
      /\bdmf\b|drug master file/gi,
    ],
  },
  {
    type: "TECHNICO_REGLEMENTAIRE",
    res: [
      /module\s*1\b/gi,
      /\bcpp\b|certificat de produit pharmaceutique/gi,
      /\bgmp\b|\bbpf\b|bonnes pratiques de fabrication/gi,
      /l[ée]galis|apostille|libre vente|formulaire de demande/gi,
      /\brcp\b|notice|[ée]tiquetage|mentions l[ée]gales/gi,
      /engagement|prix de cession|d[ée]cision d'enregistrement/gi,
    ],
  },
  {
    type: "QC",
    res: [
      /contr[oô]le (de )?qualit[ée].{0,40}(sur place|laboratoire|lot)/gi,
      /pr[ée]l[èe]vement|[ée]chantillon/gi,
      /lot(s)? soumis|analyse du lot|conformit[ée] du lot/gi,
      /laboratoire national|laboratoire de contr[oô]le/gi,
    ],
  },
];

/**
 * Type de la lettre, au COMPTAGE de signaux. PURE — testée sur la structure de nos lettres
 * réelles. Renvoie null quand rien ne se dégage (lettre trop courte, OCR raté) : mieux vaut
 * « indéterminé » qu'un type affirmé à tort.
 */
export function classifyReserveType(raw: string): ReserveType | null {
  const text = (raw ?? "").slice(0, 200_000);
  if (text.trim().length < 40) return null;
  let best: ReserveType | null = null;
  let bestScore = 0;
  for (const { type, res } of TYPE_SIGNALS) {
    let score = 0;
    for (const re of res) score += (text.match(re) ?? []).length;
    if (score > bestScore) { best = type; bestScore = score; }
  }
  return bestScore >= 2 ? best : null; // deux signaux minimum : un mot isolé ne fait pas un type
}

export const RESERVE_TYPE_LABELS: Record<ReserveType, string> = {
  TECHNICO_REGLEMENTAIRE: "Technico-réglementaire (module 1)",
  QC: "Contrôle qualité (sur place)",
  EVALUATION_SCIENTIFIQUE: "Évaluation scientifique (modules 3 & 5)",
};

/** Normalise un code de section abîmé par l'OCR : « 3.2. S.4.3 » → « 3.2.S.4.3 ». */
function cleanSectionCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/**
 * Découpe le texte en points de réserve, en PORTANT sur chaque point la section CTD et le sujet
 * de l'en-tête englobant. À défaut de toute structure, découpe par paragraphes (comportement
 * historique, conservé pour les lettres non structurées).
 */
export function decomposeReserveText(raw: string, maxPoints = 200): ReservePoint[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");

  interface Chunk { text: string; sectionCode: string | null; subject: string | null }
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let sawHeader = false;
  let section: string | null = null;
  let subject: string | null = null;
  let currentSection: string | null = null;
  let currentSubject: string | null = null;

  const flush = () => {
    if (current.length) chunks.push({ text: current.join("\n").trim(), sectionCode: currentSection, subject: currentSubject });
    current = [];
  };

  for (const line of lines) {
    // Section AVANT point : les deux commencent par un chiffre, et c'est l'en-tête qui donne
    // leur sens aux points qui suivent.
    const sec = asSectionHeader(line);
    if (sec) {
      flush();
      section = cleanSectionCode(sec);
      continue;
    }
    const subj = SUBJECT_RE.exec(line);
    if (subj && line.trim().length <= 70 && !POINT_RE.test(line)) {
      flush();
      subject = (subj[1] ?? subj[2] ?? "").trim().replace(/\s+/g, " ");
      section = null; // nouveau sujet → les sections précédentes ne s'appliquent plus
      continue;
    }
    if (POINT_RE.test(line)) {
      flush();
      current = [line];
      currentSection = section;
      currentSubject = subject;
      sawHeader = true;
    } else if (current.length || line.trim()) {
      if (current.length === 0) { currentSection = section; currentSubject = subject; }
      current.push(line);
    }
  }
  flush();

  // Aucun en-tête reconnu nulle part → découpe par blocs de paragraphes (lettres non structurées).
  let blocks: Chunk[] = sawHeader
    ? chunks
    : text.split(/\n{2,}/).map((b) => ({ text: b.trim(), sectionCode: null, subject: null }));
  blocks = blocks.filter((b) => b.text.length > 3).slice(0, maxPoints);

  return blocks.map((b, i) => ({
    ordinal: i + 1,
    category: categorizeReserve(b.text),
    verbatim: b.text.slice(0, 4000),
    sectionCode: b.sectionCode,
    subject: b.subject,
  }));
}
