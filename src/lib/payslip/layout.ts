/**
 * LES DÉCISIONS DE MISE EN PAGE — pures, donc vérifiables sans écrire un seul PDF.
 *
 * Le rendu lui-même appelle une bibliothèque (pdfkit) : on ne peut pas l'exécuter dans un test
 * sans produire un fichier et le relire. Mais tout ce qui se DÉCIDE avant de dessiner — quelle
 * taille pour ce fragment, quelles largeurs de colonnes pour ce tableau, où couper une page —
 * est de l'arithmétique. C'est cette part-là qui se trompe en silence, et c'est donc elle qu'on
 * isole ici.
 *
 * ── LE CAS QUI COMMANDE TOUT : LE BULLETIN DE PAIE ──────────────────────────────────────────
 *
 * Sur un bulletin, la mise en page EST l'information : des colonnes de montants qui glissent
 * d'une case font un document faux, pas un document laid. Les largeurs de colonnes sont donc
 * calculées sur le CONTENU RÉEL de chaque colonne, pas réparties également — une colonne
 * « Libellé » et une colonne « Montant » n'ont pas le même besoin, et l'égalité tronquerait la
 * première tout en laissant la seconde à moitié vide.
 */

/** Ce que le rendu doit savoir d'un fragment de texte. */
export interface RunMetrics {
  bold: boolean;
  italic: boolean;
  sizePt: number | null;
}

/** Taille du corps de texte quand le document n'en déclare pas. */
export const BASE_SIZE_PT = 10;
/** Taille d'un titre Word sans taille explicite. */
export const HEADING_SIZE_PT = 14;
/** Bornes de sécurité : un `w:sz` aberrant ne doit pas produire une page d'un seul mot. */
export const MIN_SIZE_PT = 5;
export const MAX_SIZE_PT = 48;

/**
 * LA TAILLE EFFECTIVE d'un fragment.
 *
 * Word peut déclarer n'importe quoi, y compris des valeurs qui n'ont pas de sens une fois
 * converties (un `w:sz` corrompu, une feuille de style exotique). On borne : au-delà, la page
 * n'affiche plus qu'un mot, et l'on croit le document vide.
 */
export function effectiveSizePt(run: RunMetrics, heading: boolean): number {
  const brut = run.sizePt ?? (heading ? HEADING_SIZE_PT : BASE_SIZE_PT);
  return Math.min(MAX_SIZE_PT, Math.max(MIN_SIZE_PT, brut));
}

/** Le nom de police pdfkit correspondant — les quatre variantes standard suffisent. */
export function fontName(run: RunMetrics, heading: boolean): string {
  const gras = run.bold || heading;
  if (gras && run.italic) return "Helvetica-BoldOblique";
  if (gras) return "Helvetica-Bold";
  if (run.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

/**
 * LES LARGEURS DE COLONNES D'UN TABLEAU, proportionnelles au contenu.
 *
 * On mesure la ligne la plus longue de chaque colonne (en caractères — une approximation
 * suffisante, et surtout STABLE, là où une mesure typographique dépendrait de la police), puis
 * on répartit la largeur disponible dans ces proportions.
 *
 * Deux garde-fous, et ils comptent autant que le calcul :
 *
 * • **un plancher par colonne** : sans lui, une colonne « N° » d'un caractère recevrait trois
 *   points de large et son contenu se briserait verticalement, une lettre par ligne ;
 * • **un plafond** : une colonne contenant un commentaire de 400 caractères absorberait toute
 *   la table et écraserait les montants — or ce sont les montants qu'on vient lire.
 */
export function columnWidths(rows: readonly (readonly string[])[], totalWidth: number): number[] {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (cols === 0 || totalWidth <= 0) return [];
  if (cols === 1) return [totalWidth];

  const longueurs = Array.from({ length: cols }, (_, c) =>
    rows.reduce((m, r) => Math.max(m, (r[c] ?? "").length), 1),
  );

  // LE PLANCHER est servi D'ABORD, à tout le monde : une colonne « N° » d'un caractère doit
  // rester lisible, sinon son contenu se brise verticalement, une lettre par ligne.
  const plancher = Math.min(totalWidth / cols / 2, 28);
  // LE PLAFOND S'ADAPTE AU NOMBRE DE COLONNES. Un plafond fixe à 60 % force presque l'égalité
  // sur un tableau à DEUX colonnes — où l'écart est justement toute l'information (un libellé
  // long face à un montant court). À trois colonnes et plus, il redevient serré, parce que c'est
  // là qu'une colonne bavarde écraserait les montants qu'on vient lire.
  const plafond = totalWidth * Math.max(0.5, 1 - 0.25 * (cols - 1));

  const largeurs = new Array<number>(cols).fill(plancher);
  const reste = totalWidth - plancher * cols;
  const total = longueurs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cols; i++) largeurs[i] += (longueurs[i] / total) * reste;

  // ── POURQUOI UNE BOUCLE, ET NON UN RATTRAPAGE PROPORTIONNEL ──────────────────────────────
  //
  // La version naïve bornait puis remettait la somme à la largeur voulue en multipliant tout par
  // un facteur — ce qui REDÉPASSAIT le plafond qu'on venait d'appliquer, et la colonne bavarde
  // reprenait toute la table. Le test l'a attrapée : c'est exactement le défaut qu'on ne voit
  // pas à l'œil sur un document d'essai, et qu'on découvre sur un vrai bulletin.
  //
  // On écrête donc, et l'on REDISTRIBUE l'excédent aux colonnes non écrêtées, au prorata de leur
  // contenu — en répétant, car un report peut à son tour faire dépasser quelqu'un. Chaque tour
  // écrête au moins une colonne, sinon il s'arrête : la boucle termine.
  const ecretees = new Set<number>();
  for (let tour = 0; tour < cols; tour++) {
    const debordent = largeurs.map((w, i) => (w > plafond && !ecretees.has(i) ? i : -1)).filter((i) => i >= 0);
    if (debordent.length === 0) break;
    let excedent = 0;
    for (const i of debordent) { excedent += largeurs[i] - plafond; largeurs[i] = plafond; ecretees.add(i); }
    const libres = largeurs.map((_, i) => i).filter((i) => !ecretees.has(i));
    if (libres.length === 0) {
      // Tout est au plafond et il reste de la place : on la partage également plutôt que de
      // laisser un blanc à droite du tableau.
      for (let i = 0; i < cols; i++) largeurs[i] += excedent / cols;
      break;
    }
    const totalLibre = libres.reduce((a, i) => a + longueurs[i], 0);
    for (const i of libres) largeurs[i] += (longueurs[i] / totalLibre) * excedent;
  }

  return largeurs;
}

/**
 * RESTE-T-IL LA PLACE de dessiner ce bloc, ou faut-il changer de page ?
 *
 * On refuse de couper à moins d'une ligne de la fin : une ligne solitaire en bas de page, dont
 * la suite est ailleurs, se lit deux fois avant d'être comprise.
 */
export function needsNewPage(cursorY: number, blockHeight: number, pageBottom: number, lineHeight: number): boolean {
  return cursorY + Math.min(blockHeight, lineHeight * 2) > pageBottom;
}
