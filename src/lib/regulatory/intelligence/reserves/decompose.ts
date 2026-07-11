/**
 * DÉCOMPOSITION DES RÉSERVES ANPP (G9) — découpe le texte VERBATIM d'une lettre de réserves
 * (océrisé) en POINTS numérotés + catégorisation par mots-clés. Déterministe et pur.
 * Chaque point conserve l'extrait EXACT (aucune reformulation).
 */

export interface ReservePoint {
  ordinal: number;
  category: string;
  verbatim: string;
}

// En-têtes de point : "1.", "1)", "Réserve 1", "Point 3", "- ", "•".
const POINT_RE = /^\s*(?:(?:r[ée]serve|point|observation|remarque)\s*(?:n[°o]\s*)?\d+|\d+[.)]|[-•*])\s*[:.\-)]?\s*/i;

const CATEGORIES: { cat: string; kws: RegExp }[] = [
  { cat: "QUALITÉ", kws: /qualit|cmc|fabricat|proc[ée]d[ée]|sp[ée]cification|impuret|excipient|principe actif|substance active/i },
  { cat: "STABILITÉ", kws: /stabilit|conservation|p[ée]remption|dur[ée]e de vie|zone climatique/i },
  { cat: "ANALYTIQUE", kws: /m[ée]thode|validation analytique|dosage|hplc|analyse/i },
  { cat: "CLINIQUE", kws: /clinique|efficacit|innocuit|indication|posologie|bio[ée]quivalence/i },
  { cat: "ÉTIQUETAGE", kws: /[ée]tiquet|notice|rcp|conditionnement|mentions/i },
  { cat: "ADMINISTRATIF", kws: /administrat|formulaire|certificat|cpp|gmp|libre vente|l[ée]galis|signature|droit/i },
];

export function categorizeReserve(text: string): string {
  for (const c of CATEGORIES) if (c.kws.test(text)) return c.cat;
  return "AUTRE";
}

/** Découpe le texte en points de réserve. À défaut de numérotation, découpe par paragraphes. */
export function decomposeReserveText(raw: string, maxPoints = 200): ReservePoint[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");

  const chunks: string[] = [];
  let current: string[] = [];
  let sawHeader = false;
  for (const line of lines) {
    if (POINT_RE.test(line)) {
      if (current.length) chunks.push(current.join("\n").trim());
      current = [line];
      sawHeader = true;
    } else if (current.length || line.trim()) {
      current.push(line);
    }
  }
  if (current.length) chunks.push(current.join("\n").trim());

  // Aucun en-tête numéroté reconnu → découpe par blocs de paragraphes.
  let blocks = sawHeader ? chunks : text.split(/\n{2,}/).map((b) => b.trim());
  blocks = blocks.filter((b) => b.length > 3).slice(0, maxPoints);

  return blocks.map((b, i) => ({
    ordinal: i + 1,
    category: categorizeReserve(b),
    verbatim: b.slice(0, 4000),
  }));
}
