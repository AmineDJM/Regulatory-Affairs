/**
 * Découpage d'un texte réglementaire en SECTIONS (article/annexe/chapitre) — unité de RAG +
 * citation. Déterministe, pur. À défaut d'en-têtes reconnus, découpe par blocs de paragraphes.
 */
export interface ImportedSection {
  path: string;
  heading: string | null;
  text: string;
  ordinal: number;
}

const HEADING_RE = /^\s*((?:article|art\.?)\s+\d+[a-z]?|chapitre\s+[\wéè]+|annexe\s+[\wéè]+|titre\s+[\wéè]+|section\s+\d+|\d+(?:\.\d+){1,4})\b[.:)\s-]*(.*)$/i;

export function splitIntoSections(raw: string, maxSections = 800): ImportedSection[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");

  const sections: ImportedSection[] = [];
  let current: ImportedSection | null = null;
  let ordinal = 0;

  const push = () => {
    if (current && current.text.trim().length > 0) {
      current.text = current.text.trim().slice(0, 8000);
      sections.push(current);
    }
  };

  for (const line of lines) {
    const m = HEADING_RE.exec(line);
    if (m) {
      push();
      const path = m[1].replace(/\s+/g, " ").trim();
      const heading = m[2]?.trim() || null;
      current = { path, heading, text: heading ? heading + "\n" : "", ordinal: ordinal++ };
    } else if (current) {
      current.text += line + "\n";
    } else {
      current = { path: `§${++ordinal}`, heading: null, text: line + "\n", ordinal };
    }
    if (sections.length >= maxSections) break;
  }
  push();

  // Aucun en-tête reconnu → découpe par blocs de paragraphes.
  if (sections.length <= 1 && text.includes("\n\n")) {
    return text
      .split(/\n{2,}/)
      .map((b, i) => ({ path: `§${i + 1}`, heading: null, text: b.trim().slice(0, 8000), ordinal: i }))
      .filter((s) => s.text.length > 0)
      .slice(0, maxSections);
  }

  return sections.slice(0, maxSections);
}
