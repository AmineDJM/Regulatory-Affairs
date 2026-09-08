/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LIRE UNE QUANTITÉ DANS UNE PHRASE — module PUR, sans aucun import.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ── LE DÉFAUT ─────────────────────────────────────────────────────────────────────────
 *
 * Le décodeur savait décaler « un peu » (0,5 cm), « normalement » (1 cm) ou « beaucoup »
 * (2 cm). Il ne savait pas lire « décale ce titre de 1,2 cm à droite » : la phrase portait
 * la mesure exacte, et le décodeur la remplaçait par son estimation. Une édition de
 * précision qui arrondit n'est pas une édition de précision.
 *
 * Pire, et c'est le défaut silencieux : `rang()` prend le PREMIER nombre de la phrase.
 * « décale le paragraphe 3 de 1,2 cm » lui donnait 1 — le chiffre des unités de « 1,2 ».
 * Il déplaçait donc le paragraphe 1. Aucun message d'erreur : la mauvaise cible, annoncée
 * comme faite, est le défaut le plus coûteux de tout ce système (§104.7).
 *
 * ── LA RÈGLE QUI REND CETTE LECTURE SÛRE ──────────────────────────────────────────────
 *
 * UNE MESURE N'EXISTE QUE SI L'UNITÉ EST ÉCRITE. « 1,2 cm », « 4 mm », « 12 pt » sont des
 * mesures ; « 3 », « le troisième », « page 12 » n'en sont pas. Sans unité, ce module rend
 * `null` et l'appelant garde son estimation qualitative — jamais l'inverse. C'est ce qui
 * empêche un rang d'être lu comme une distance, et c'est vérifiable en une ligne.
 */

/** Les unités de LONGUEUR reconnues, et leur valeur en centimètres. */
const EN_CM: Record<string, number> = {
  cm: 1, centimetre: 1, centimetres: 1, centimètre: 1, centimètres: 1,
  mm: 0.1, millimetre: 0.1, millimetres: 0.1, millimètre: 0.1, millimètres: 0.1,
  m: 100, metre: 100, metres: 100, mètre: 100, mètres: 100,
  pouce: 2.54, pouces: 2.54, inch: 2.54, inches: 2.54, in: 2.54,
  // Un point typographique vaut 1/72 de pouce — utile quand quelqu'un parle en points
  // pour une position plutôt que pour une police.
  pt: 2.54 / 72, point: 2.54 / 72, points: 2.54 / 72,
};

const UNITES = Object.keys(EN_CM).sort((a, b) => b.length - a.length).join("|");

/** « 1,2 » et « 1.2 » sont le même nombre : ici on écrit avec une virgule. */
const nombre = (brut: string): number => Number(brut.replace(",", "."));

/**
 * LA MESURE ÉCRITE DANS LA PHRASE, en centimètres — `null` si aucune UNITÉ n'est écrite.
 *
 * Rend la PREMIÈRE mesure trouvée : « décale de 1,2 cm puis remonte de 4 mm » est deux
 * gestes, pas un — c'est à l'appelant de les découper, pas à ce module de choisir.
 */
export function lireDistanceCm(phrase: string): number | null {
  const m = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNITES})\\b`, "i").exec(phrase);
  if (!m) return null;
  const valeur = nombre(m[1]!) * EN_CM[m[2]!.toLowerCase()]!;
  return Number.isFinite(valeur) && valeur > 0 ? Math.round(valeur * 1000) / 1000 : null;
}

/** La mesure écrite, en POINTS typographiques — pour une taille de police ou un espacement. */
export function lirePoints(phrase: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(pt|points?)\b/i.exec(phrase);
  if (!m) return null;
  const v = nombre(m[1]!);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * LA PHRASE SANS SES MESURES — pour que la lecture d'un RANG ne prenne pas le chiffre d'une
 * distance. « le paragraphe 3 de 1,2 cm » devient « le paragraphe 3 de », et le rang est 3.
 */
export function sansMesures(phrase: string): string {
  return phrase.replace(new RegExp(`\\d+(?:[.,]\\d+)?\\s*(?:${UNITES})\\b`, "gi"), " ");
}

/** Y a-t-il une mesure explicite ? Utile pour dire « je t'ai obéi au millimètre » plutôt que « environ ». */
export const porteUneMesure = (phrase: string): boolean => lireDistanceCm(phrase) !== null;

/**
 * L'INTERLIGNE demandé. « interligne 1,5 », « double interligne », « interligne simple ».
 * Rend un MULTIPLE de la ligne — 1 = simple, 1,5, 2 = double. `null` si rien de sûr.
 */
export function lireInterligne(phrase: string): number | null {
  const p = phrase.toLowerCase();
  if (!/\b(interligne|espacement des lignes|line spacing)\b/.test(p)) return null;
  const m = /\b(\d+(?:[.,]\d+)?)\b/.exec(sansMesures(p));
  if (m) {
    const v = nombre(m[1]!);
    return v >= 0.5 && v <= 5 ? v : null;
  }
  if (/\bdouble\b/.test(p)) return 2;
  if (/\b(simple|normal)\b/.test(p)) return 1;
  if (/\b(un et demi|1 et demi)\b/.test(p)) return 1.5;
  return null;
}
