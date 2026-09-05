/**
 * LES MONTANTS EN LETTRES — « Arrêtée la présente facture à la somme de … ».
 *
 * Une facture algérienne porte son total en toutes lettres ; un devis et un bon de commande le
 * portent souvent aussi. La règle est déterministe et testable : on ne demande pas à un modèle
 * d'écrire « quarante et un mille trois cents dinars » — il se tromperait une fois sur cent, et
 * ce serait sur une facture.
 *
 * Orthographe : l'usage bancaire courant en Algérie — « deux cent mille », « quatre-vingts »,
 * « mille » invariable, « cent » et « vingt » accordés quand ils terminent le nombre, « et » devant
 * un et onze (« vingt et un », « soixante et onze »), jamais devant « quatre-vingt-un ».
 *
 * Module PUR : aucun import.
 */

const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function moinsDeCent(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) {
    // soixante-dix → soixante + (dix … dix-neuf) ; quatre-vingt-dix idem, sans « et ».
    const reste = n - (d === 7 ? 60 : 80);
    const liaison = d === 7 && reste === 11 ? " et " : "-";
    return `${DIZAINES[d]}${liaison}${UNITES[reste]}`;
  }
  if (u === 0) return d === 8 ? "quatre-vingts" : DIZAINES[d];
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

function moinsDeMille(n: number): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c === 0) return moinsDeCent(reste);
  const centaines = c === 1 ? "cent" : `${UNITES[c]} cent${reste === 0 ? "s" : ""}`;
  return reste === 0 ? centaines : `${centaines} ${moinsDeCent(reste)}`;
}

/** Un entier positif en lettres (jusqu'à 999 999 999 999). */
export function nombreEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error("nombre invalide");
  n = Math.floor(n);
  if (n === 0) return "zéro";
  if (n >= 1_000_000_000_000) throw new Error("nombre trop grand pour être écrit en lettres");
  const parts: string[] = [];
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1_000);
  const reste = n % 1_000;
  if (milliards) parts.push(`${moinsDeMille(milliards)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) parts.push(`${moinsDeMille(millions)} million${millions > 1 ? "s" : ""}`);
  if (milliers) parts.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers)} mille`);
  if (reste) parts.push(moinsDeMille(reste));
  // « quatre-vingts mille » perd son s devant mille ; « deux cents mille » aussi.
  return parts.join(" ").replace(/vingts mille/g, "vingt mille").replace(/cents mille/g, "cent mille");
}

export interface Devise {
  singulier: string;
  pluriel: string;
  /** La subdivision, au singulier et au pluriel : « centime » / « centimes ». */
  sous: string;
  sousPluriel: string;
}

export const DINAR: Devise = { singulier: "dinar algérien", pluriel: "dinars algériens", sous: "centime", sousPluriel: "centimes" };

/**
 * Un montant en lettres, dinars et centimes :
 * 41 300,50 → « quarante et un mille trois cents dinars algériens et cinquante centimes ».
 */
export function montantEnLettres(montant: number, devise: Devise = DINAR): string {
  if (!Number.isFinite(montant)) throw new Error("montant invalide");
  const arrondi = Math.round(Math.abs(montant) * 100) / 100;
  const entier = Math.floor(arrondi);
  const centimes = Math.round((arrondi - entier) * 100);
  const unite = entier <= 1 ? devise.singulier : devise.pluriel;
  const base = `${nombreEnLettres(entier)} ${unite}`;
  if (centimes <= 0) return base;
  return `${base} et ${nombreEnLettres(centimes)} ${centimes === 1 ? devise.sous : devise.sousPluriel}`;
}
