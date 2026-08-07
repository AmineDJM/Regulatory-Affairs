/**
 * CARTE DES PAGES — le chaînon entre un constat et la pièce.
 *
 * Le texte extrait d'un document est un long ruban de caractères ; les pages n'y existent plus.
 * Or tout ce qui rend un constat DÉFENDABLE passe par la page : « le certificat GMP est expiré »
 * ne vaut que si l'on peut ouvrir le PDF à la page 52 et le montrer.
 *
 * La carte est un simple tableau : `pageMap[i]` = position (en caractères) du DÉBUT de la page
 * `i + 1` dans le contenu. Elle se construit au moment où le contenu se construit — extraction
 * native ou OCR — et se lit ensuite en O(log n) pour convertir n'importe quelle position en
 * numéro de page.
 *
 * Module PUR : la conversion position → page doit être testable sans PDF ni base.
 */

/** Séparateur entre pages dans le contenu assemblé — le même partout, sinon la carte ment. */
export const PAGE_SEPARATOR = "\n\n";

/**
 * Construit le contenu et sa carte à partir des textes de pages.
 * Le contenu N'EST PAS retaillé (`trim`) : retirer les blancs de tête décalerait toutes les
 * positions et fausserait la carte d'autant.
 */
export function buildPagedContent(pages: string[]): { content: string; pageMap: number[] } {
  const pageMap: number[] = [];
  let cursor = 0;
  const parts: string[] = [];
  for (const raw of pages) {
    const text = raw ?? "";
    pageMap.push(cursor);
    parts.push(text);
    cursor += text.length + PAGE_SEPARATOR.length;
  }
  return { content: parts.join(PAGE_SEPARATOR), pageMap };
}

/** Page (1-based) contenant la position `offset`. Recherche binaire — la carte est croissante. */
export function pageAtOffset(pageMap: number[], offset: number): number {
  if (pageMap.length === 0) return 1;
  let lo = 0;
  let hi = pageMap.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (pageMap[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Intervalle de pages EXACT couvert par la tranche [start, end) du contenu. */
export function pageSpanOfSlice(pageMap: number[], start: number, end: number): { start: number; end: number } {
  return {
    start: pageAtOffset(pageMap, Math.max(0, start)),
    end: pageAtOffset(pageMap, Math.max(0, end - 1)),
  };
}

/** Espace normalisé : les PDF cassent les lignes n'importe où, la citation du modèle non. */
function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * ANCRE une preuve citée dans le document : retrouve l'extrait et rend sa page EXACTE.
 *
 * C'est la vérification qui prime sur tout le reste : le modèle ESTIME une page, l'ancrage la
 * PROUVE. On cherche le début de la citation (60 caractères suffisent à être discriminant sans
 * être fragile) dans une version du texte aux espaces normalisés — un PDF coupe ses lignes où
 * bon lui semble, jamais la citation.
 *
 * Rend `null` quand l'extrait est introuvable : une preuve qu'on ne retrouve pas dans la pièce
 * ne doit surtout pas recevoir une page inventée — c'est précisément ce qu'on cherche à bannir.
 */
export function anchorEvidence(content: string, pageMap: number[], evidence: string | null | undefined): number | null {
  const needle = squash(evidence ?? "").slice(0, 60);
  if (needle.length < 12 || pageMap.length === 0) return null;

  // Correspondance insensible aux espaces : on parcourt le contenu en maintenant la position
  // RÉELLE du début de la fenêtre comparée — c'est elle qui donne la page.
  const squashedTarget = needle.toLowerCase();
  const lower = content.toLowerCase();
  let win = "";
  const starts: number[] = [];
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const isSpace = /\s/.test(ch);
    if (isSpace && (win.endsWith(" ") || win.length === 0)) continue; // espaces consécutifs → un seul
    win += isSpace ? " " : ch;
    starts.push(i);
    if (win.length > squashedTarget.length) {
      win = win.slice(1);
      starts.shift();
    }
    if (win === squashedTarget) return pageAtOffset(pageMap, starts[0]);
  }
  return null;
}
