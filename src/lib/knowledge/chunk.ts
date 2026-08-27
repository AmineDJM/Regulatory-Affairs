import type { ChunkKind, KnowledgeChunkDraft } from "./contract";
import { clip } from "./text";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DÉCOUPAGE — suivre la STRUCTURE, jamais compter les jetons.
 *
 * ── POURQUOI PAS « TOUS LES 500 JETONS » ─────────────────────────────────────────────────
 *
 * Parce qu'un tableau coupé en deux ne veut plus rien dire, qu'une clause contractuelle scindée
 * au milieu devient citable à contresens, et qu'un extrait sans page n'est opposable à personne.
 * Un découpage arbitraire donne des morceaux de la bonne TAILLE et de la mauvaise NATURE — et
 * c'est la nature qui décide si la réponse sera juste.
 *
 * On coupe donc là où le document se coupe lui-même : titres, sections, pages, diapositives,
 * feuilles, messages d'un fil. La taille n'est qu'une borne de sécurité, appliquée APRÈS.
 *
 * ── CE QUE CHAQUE MORCEAU SAIT DE LUI-MÊME ───────────────────────────────────────────────
 *
 * Son document parent, son rang de lecture, son étiquette (titre de section, numéro de page) et
 * son `locator`. C'est ce qui permet de répondre « page 12, section 3.2 » au lieu de « quelque
 * part dans ce document » — la différence entre une citation et une affirmation.
 *
 * Module PUR : testable sans base, sans fichier, sans modèle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Bornes de SÉCURITÉ, pas de découpage. Un morceau plus long qu'un contexte utile finit tronqué
 * n'importe où au moment de la recherche ; un morceau minuscule pollue l'index sans rien dire.
 */
export const MAX_CHUNK_CHARS = 4_000;
export const MIN_CHUNK_CHARS = 40;

/** Un titre : ligne courte, sans ponctuation finale, souvent numérotée ou en capitales. */
const HEADING = /^\s{0,3}(?:(?:\d+(?:\.\d+)*)[.)]?\s+)?([^\n]{3,90})\s*$/;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/[.;:,]$/.test(t)) return false;            // une phrase, pas un titre
  if (!HEADING.test(t)) return false;
  const numbered = /^\d+(\.\d+)*[.)]?\s/.test(t); // « 3.2 Stabilité »
  const shouty = t === t.toUpperCase() && /[A-ZÀ-Þ]/.test(t) && t.length >= 6;
  const titled = /^[A-ZÀ-Þ]/.test(t) && t.split(/\s+/).length <= 10;
  return numbered || shouty || titled;
}

/**
 * DÉCOUPE UN TEXTE LIBRE par ses titres, puis par paragraphes si aucun titre n'apparaît.
 *
 * L'absence de titre n'est pas un échec : beaucoup de documents n'en ont pas. On tombe alors sur
 * les paragraphes, qui restent une frontière du document — pas un compteur.
 */
export function chunkText(text: string, opts: { kind?: ChunkKind; locator?: string | null } = {}): KnowledgeChunkDraft[] {
  const kind = opts.kind ?? "section";
  const lines = (text ?? "").split(/\r?\n/);

  const sections: { label: string | null; body: string[] }[] = [];
  let current: { label: string | null; body: string[] } = { label: null, body: [] };

  for (const line of lines) {
    if (looksLikeHeading(line) && current.body.join("").trim().length > MIN_CHUNK_CHARS) {
      sections.push(current);
      current = { label: line.trim(), body: [] };
    } else if (looksLikeHeading(line) && !current.label && !current.body.join("").trim()) {
      current.label = line.trim(); // un titre en tête de document
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);

  const withText = sections
    .map((s) => ({ label: s.label, text: s.body.join("\n").trim() }))
    .filter((s) => s.text.length >= MIN_CHUNK_CHARS);

  // Aucun titre exploitable → on retombe sur les paragraphes.
  const base = withText.length > 1 || withText[0]?.label
    ? withText
    : splitParagraphs((text ?? "").trim()).map((t) => ({ label: null as string | null, text: t }));

  const out: KnowledgeChunkDraft[] = [];
  for (const s of base) {
    for (const piece of capLength(s.text)) {
      out.push({ kind, ord: out.length, label: s.label, text: piece, locator: opts.locator ?? null });
    }
  }
  return out;
}

/** Coupe aux paragraphes — la frontière la plus fine que le document déclare lui-même. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_CHUNK_CHARS);
}

/**
 * BORNE DE SÉCURITÉ. Une section légitimement longue (un article de contrat) est découpée aux
 * PHRASES, jamais au milieu d'un mot : ce qui est stocké doit rester citable tel quel.
 */
function capLength(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHUNK_CHARS) {
    const window = rest.slice(0, MAX_CHUNK_CHARS);
    const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
    const at = cut > MAX_CHUNK_CHARS * 0.5 ? cut + 1 : MAX_CHUNK_CHARS;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest.length >= MIN_CHUNK_CHARS) out.push(rest);
  else if (out.length) out[out.length - 1] += `\n${rest}`;
  return out;
}

/**
 * DÉCOUPAGE PAR UNITÉ NATURELLE — pages d'un PDF, diapositives d'un PPTX, feuilles d'un classeur,
 * messages d'un fil. Ici la frontière est donnée par le format lui-même : on ne l'invente pas.
 *
 * Une unité vide n'est PAS indexée : une diapositive de transition n'apprend rien et diluerait
 * la recherche.
 */
export function chunkUnits(
  units: { label?: string | null; locator?: string | null; text: string }[],
  kind: ChunkKind,
): KnowledgeChunkDraft[] {
  const out: KnowledgeChunkDraft[] = [];
  for (const u of units) {
    const t = (u.text ?? "").trim();
    if (t.length < MIN_CHUNK_CHARS) continue;
    for (const piece of capLength(t)) {
      out.push({ kind, ord: out.length, label: u.label ?? null, text: piece, locator: u.locator ?? null });
    }
  }
  return out;
}

/**
 * UN TABLEAU RESTE ENTIER — c'est la raison d'être de ce module.
 *
 * Sérialisé en lignes « colonne: valeur », il reste lisible par un humain ET retrouvable par une
 * recherche lexicale (« Molécule A » trouve sa ligne). Le découper en tranches de jetons
 * détruirait l'association entre l'en-tête et la valeur, c'est-à-dire tout le sens.
 */
export function chunkTable(
  rows: Record<string, string>[],
  opts: { label?: string | null; locator?: string | null; maxRows?: number } = {},
): KnowledgeChunkDraft[] {
  const max = opts.maxRows ?? 200;
  const kept = rows.slice(0, max);
  if (!kept.length) return [];

  const body = kept
    .map((r, i) => `${i + 1}. ` + Object.entries(r).filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v}`).join(" · "))
    .join("\n");

  const note = rows.length > max ? `\n(+${rows.length - max} lignes non indexées)` : "";
  return capLength(clip(body + note, MAX_CHUNK_CHARS * 4)).map((text, i) => ({
    kind: "table" as ChunkKind,
    ord: i,
    label: opts.label ?? null,
    text,
    locator: opts.locator ?? null,
  }));
}

/** Renumérote un assemblage de morceaux — l'ordre de LECTURE, pas l'ordre d'insertion. */
export function renumber(chunks: KnowledgeChunkDraft[]): KnowledgeChunkDraft[] {
  return chunks.map((c, i) => ({ ...c, ord: i }));
}
