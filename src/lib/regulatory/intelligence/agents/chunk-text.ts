/**
 * DÉCOUPAGE DU TEXTE POUR L'ANALYSE IA — unité « ~10 pages » (jamais plus par appel).
 *
 * Le texte extrait/océrisé d'un document (potentiellement des milliers de pages) est découpé en
 * parts d'au plus `aiChunkChars()` caractères (≈ 10 pages), sur des frontières de mots/lignes.
 * Chaque part est envoyée SÉPARÉMENT à l'IA (en parallèle, borné) — jamais le document entier.
 */

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Pages (approximatives) couvertes par une part. */
export function aiChunkPages(): number {
  return clampInt(process.env.REG_AI_CHUNK_PAGES, 10, 1, 100);
}

/** Taille d'une part d'analyse en caractères ≈ pages × caractères/page (défaut 10 × 2400 = 24 000). */
export function aiChunkChars(): number {
  const perPage = clampInt(process.env.REG_AI_CHARS_PER_PAGE, 2400, 500, 8000);
  return aiChunkPages() * perPage;
}

/**
 * Intervalle de pages APPROXIMATIF couvert par la part `index` (base 0).
 *
 * Le découpage est fait en CARACTÈRES : on ne connaît pas les vraies frontières de pages, mais
 * on sait qu'une part ≈ `aiChunkPages()` pages. Sans cet intervalle, le modèle ne peut pas
 * situer un constat : il reçoit un extrait isolé et répondrait « page 2 » en comptant depuis le
 * début de SA part — un numéro faux d'autant de dizaines de pages que la part est loin dans le
 * document. Un constat qu'on ne peut pas retrouver dans la pièce est un constat qu'on ne peut
 * pas défendre.
 */
export function chunkPageSpan(index: number): { start: number; end: number } {
  const pages = aiChunkPages();
  return { start: index * pages + 1, end: (index + 1) * pages };
}

/**
 * Découpe `text` en parts d'au plus `maxChars`, en coupant de préférence sur un saut de ligne ou
 * un espace (jamais au milieu d'un mot). Renvoie [] pour un texte vide. Nombre de parts ILLIMITÉ.
 */
export function splitTextIntoChunks(text: string, maxChars: number = aiChunkChars()): string[] {
  const clean = (text ?? "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + maxChars, clean.length);
    if (end < clean.length) {
      // Recule jusqu'à une frontière propre (mais pas trop tôt : au moins 60 % de la part).
      const window = clean.slice(i, end);
      const nl = window.lastIndexOf("\n");
      const sp = window.lastIndexOf(" ");
      const cut = nl > maxChars * 0.6 ? nl : sp > maxChars * 0.6 ? sp : -1;
      if (cut > 0) end = i + cut;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    i = end;
  }
  return chunks;
}
