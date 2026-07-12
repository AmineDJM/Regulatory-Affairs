import { CTD_SECTIONS } from "./taxonomy";

/**
 * DÉTECTION MULTI-SECTIONS dans le TEXTE d'un document (Phase 3 bis).
 *
 * Corrige le cas des dossiers organisés en UN gros PDF par module (« Module 3.pdf » qui contient en
 * réalité 3.2.S, 3.2.P, 3.2.P.5, 3.2.P.8…) : au lieu d'une étiquette unique, on détecte TOUTES les
 * sections CTD réellement présentes, pour que la complétude ne crie pas « section manquante » à tort.
 *
 * PRÉCISION (anti-faux-positif) : un code CTD ne compte que s'il apparaît en EN-TÊTE — c.-à-d.
 * corroboré par un mot de son TITRE (ou un mot-clé) dans les ~90 caractères qui suivent. Un simple
 * « 3.2 » ou « voir 3.2.P.8 » noyé dans le corps ne déclenche rien. Déterministe, sans IA.
 */

export interface DetectedSection {
  code: string;
  count: number; // nombre d'en-têtes corroborés trouvés
  evidence: string; // premier en-tête rencontré (preuve)
}

const STOP = new Set([
  "informations", "information", "produit", "product", "section", "module", "generale", "general", "générale",
  "study", "report", "rapport", "données", "data", "pour", "avec", "dans", "études", "etudes", "the", "and",
  "des", "les", "une", "sur", "aux", "par", "test", "results", "résultats", "resultats", "table", "list",
]);

/** Mots distinctifs (≥3 lettres) du titre + mots-clés d'une section, pour corroborer un en-tête. */
function titleWords(section: (typeof CTD_SECTIONS)[number]): string[] {
  const raw = [section.title, ...section.keywords].join(" ").toLowerCase();
  const words = raw.match(/[a-zàâäéèêëïîôöùûüç]{3,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP.has(w)))];
}

/** Regex de TOKEN d'un code CTD : bornes strictes (jamais au milieu d'un nombre/code plus long). */
function codeToken(code: string): RegExp {
  return new RegExp(`(?<![\\w.])${code.replace(/\./g, "\\.")}(?![\\w.])`, "gi");
}

/**
 * Renvoie les sections CTD présentes dans `text`, chacune corroborée par son titre. Bornée en coût
 * (scan regex par section, plafonné). `text` est le texte extrait/océrisé déjà stocké (borné).
 */
export function detectContainedSections(text: string, opts: { max?: number } = {}): DetectedSection[] {
  const t = text ?? "";
  if (t.length < 40) return [];
  const lower = t.toLowerCase();
  const out: DetectedSection[] = [];

  for (const section of CTD_SECTIONS) {
    const re = codeToken(section.code);
    const words = titleWords(section);
    if (words.length === 0) continue;
    let count = 0;
    let evidence = "";
    let m: RegExpExecArray | null;
    let scanned = 0;
    while ((m = re.exec(t)) !== null && scanned < 400) {
      scanned++;
      // Fenêtre après le code : contient-elle un mot du titre ? (en-tête corroboré)
      const window = lower.slice(m.index, m.index + 90);
      if (words.some((w) => window.includes(w))) {
        count++;
        if (!evidence) evidence = t.slice(m.index, m.index + 70).replace(/\s+/g, " ").trim();
      }
    }
    if (count >= 1) out.push({ code: section.code, count, evidence });
  }

  // Sections plus spécifiques (codes plus profonds) d'abord ; borne de sécurité.
  out.sort((a, b) => (b.code.match(/\./g)?.length ?? 0) - (a.code.match(/\./g)?.length ?? 0) || b.count - a.count);
  return out.slice(0, opts.max ?? 40);
}
