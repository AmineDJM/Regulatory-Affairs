/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN NOMBRE IMPRIMÉ — sans jamais le deviner (lot D2, §118.34, §118.59).
 *
 * Un nombre recopié d'une pièce commerciale — par le repérage déterministe ou par un modèle —
 * arrive en TEXTE, tel qu'imprimé. Ce module tranche, et AUCUN nombre lu n'entre dans un calcul
 * sans passer par lui :
 *
 *   « 1 234 567,89 » (espace, insécable, fine insécable)  → 1 234 567,89
 *   « 1.234.567,89 », « 1,234,567.89 »                    → le DERNIER séparateur est décimal
 *   « 1.200 », « 1,200 »                                  → ILLISIBLE : 1 200 ou 1,2 ? On ne choisit pas.
 *   « -5 », « (5) », « +5 », « 1e3 »                      → ILLISIBLE
 *   « 961 345,00 DA », « 15 890 DZD »                     → le suffixe de devise est accepté
 *
 * POURQUOI PAS `parseAmount` (moyens généraux). Il lit une SAISIE : une personne qui tape
 * « 1.200 » dans un champ de montant veut dire 1,2, et c'est elle qui l'a écrit. Ici le
 * séparateur vient du papier d'un tiers, et deux conventions s'y croisent : le même texte veut
 * dire deux nombres. Deux besoins, deux lecteurs — les confondre ferait payer 1 200 DZD une
 * ligne de 1,20, ou l'inverse, avec l'assurance d'avoir « lu » le papier.
 *
 * Un texte VIDE est une absence, pas une illisibilité : `{ valeur: null, raison: null }`. Une
 * absence se NOMME ailleurs (le contrôle), elle ne se confond pas avec un zéro (§118.16).
 *
 * Module PUR : aucun import (le navigateur et le serveur le lisent).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface NombreLu {
  /** La valeur lue ; `null` quand le texte est vide (ABSENT) ou illisible. */
  valeur: number | null;
  /** Pourquoi le texte est illisible ; `null` quand il est lu — ou simplement absent. */
  raison: string | null;
}

/** Les espaces qu'une pièce imprime entre les milliers : ordinaire, insécable, fine insécable, tabulation… */
const ESPACES = /[\u00a0\u202f\u2009\u2007\u2002\u2003\t ]+/g;
/** Le suffixe de devise accepté — le dinar, et lui seul : un « 1 200 EUR » n'est pas un montant en dinars. */
const DEVISE = /\s*(?:dzd|d\.\s?a\.?|da|dinars?(?:\s+alg[eé]riens?)?)\s*$/i;
/** …et en PRÉFIXE : « DZD 300,000.00 » (devis imprimés à l'anglo-saxonne) se lit comme « 300,000.00 DZD ». */
const DEVISE_PREFIXE = /^\s*(?:dzd|d\.\s?a\.?|da)\s*/i;
/** Au-delà, ce n'est plus un montant de pièce commerciale : 999 999 999 999,99 DZD. */
const MAX_CHIFFRES_ENTIERS = 12;
/** Un prix unitaire peut porter trois ou quatre décimales ; au-delà, c'est une lecture abîmée. */
const MAX_DECIMALES = 4;

const ABSENT: NombreLu = { valeur: null, raison: null };
const illisible = (raison: string): NombreLu => ({ valeur: null, raison });

const UN_SEPARATEUR = /^(\d+)([.,])(\d+)$/;
const MILLIERS_ESPACES = /^(\d{1,3}(?: \d{3})+)(?:[.,](\d+))?$/;
const MILLIERS_POINTS = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d+))?$/;
const MILLIERS_VIRGULES = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/;

/**
 * LIRE UN NOMBRE. `devise: false` refuse le suffixe « DA » (une quantité, un taux n'en portent pas).
 * Une valeur qui n'est pas une chaîne est illisible : un nombre DÉJÀ converti par un modèle a déjà
 * tranché l'ambiguïté que ce module existe pour refuser — on ne peut plus le vérifier (P3).
 */
export function analyserNombre(texte: unknown, opts: { devise?: boolean } = {}): NombreLu {
  if (texte === null || texte === undefined) return ABSENT;
  if (typeof texte !== "string") {
    return illisible("le nombre doit être recopié en texte, tel qu'imprimé — une valeur déjà convertie ne se vérifie pas");
  }
  const cite = texte.replace(ESPACES, " ").trim();
  let s = cite;
  if (opts.devise !== false) s = s.replace(DEVISE, "").replace(DEVISE_PREFIXE, "").trim();
  if (s === "") return ABSENT;
  if (/[^0-9 .,]/.test(s)) {
    return /^[-\u2212–+(]/.test(s) || /\)$/.test(s)
      ? illisible(`« ${cite} » : un signe ou une parenthèse ne se lit pas — un montant négatif ne se déduit pas d'une lecture`)
      : illisible(`« ${cite} » : des caractères inattendus — attendu des chiffres, une virgule ou un point`);
  }

  let entier: string;
  let decimales = "";
  const un = UN_SEPARATEUR.exec(s);
  if (/^\d+$/.test(s)) {
    entier = s;
  } else if (un) {
    const [, e, sep, d] = un;
    // LE CAS QU'ON NE TRANCHE PAS : un seul séparateur suivi d'exactement trois chiffres, après une partie
    // entière d'un à trois chiffres non nulle. « 1.200 » est 1 200 (milliers) ou 1,2 (décimale) selon la
    // convention de celui qui l'a imprimé. « 0,125 » ne l'est pas (on n'écrit pas « 0 » milliers), ni
    // « 1234,567 » (des milliers se groupent par trois).
    if (d.length === 3 && e.length <= 3 && /[1-9]/.test(e)) {
      const enDecimale = d.replace(/0+$/, "") ? `${e},${d.replace(/0+$/, "")}` : e;
      return illisible(`« ${cite} » : ${e} ${d} ou ${enDecimale} ? Le séparateur « ${sep} » est ambigu — saisissez le nombre depuis le papier`);
    }
    entier = e;
    decimales = d;
  } else {
    const m = MILLIERS_ESPACES.exec(s) ?? MILLIERS_POINTS.exec(s) ?? MILLIERS_VIRGULES.exec(s);
    if (!m) return illisible(`« ${cite} » : la forme de ce nombre n'est pas reconnue (séparateurs de milliers irréguliers)`);
    entier = m[1].replace(/[ .,]/g, "");
    decimales = m[2] ?? "";
  }
  if (entier.replace(/^0+(?=\d)/, "").length > MAX_CHIFFRES_ENTIERS) return illisible(`« ${cite} » : trop grand pour un montant de pièce`);
  if (decimales.length > MAX_DECIMALES) return illisible(`« ${cite} » : trop de décimales — une lecture abîmée`);
  const valeur = Number(decimales ? `${entier}.${decimales}` : entier);
  return Number.isFinite(valeur) ? { valeur, raison: null } : illisible(`« ${cite} » : nombre illisible`);
}

/** Le montant lu, ou `null` (absent ou illisible — `analyserNombre` dit lequel). */
export function montantLu(texte: unknown): number | null {
  return analyserNombre(texte).valeur;
}

/**
 * UN TAUX IMPRIMÉ EN POUR CENT — « 19 % », « 19,00 % », « 9 » — rendu en FRACTION (0,19). Le
 * modèle reçoit la consigne de recopier les taux en pour cent : « 0,19 » se lit donc 0,19 %, et
 * c'est le contrôle des taux admis qui l'arrête, au lieu qu'on devine qu'il voulait dire 19 %.
 */
export function analyserPourcentage(texte: unknown): NombreLu {
  if (texte === null || texte === undefined) return ABSENT;
  if (typeof texte !== "string") return analyserNombre(texte);
  const cite = texte.replace(ESPACES, " ").trim();
  const s = cite.replace(/\s*%\s*$/, "").trim();
  if (s === "") return ABSENT;
  const n = analyserNombre(s, { devise: false });
  if (n.valeur === null) return n.raison ? illisible(n.raison.replace(`« ${s} »`, `« ${cite} »`)) : ABSENT;
  if (n.valeur > 100) return illisible(`« ${cite} » : un taux au-delà de 100 % n'en est pas un`);
  return { valeur: Number((n.valeur / 100).toFixed(6)), raison: null };
}

/** Le taux lu, en fraction, ou `null`. */
export function pourcentageLu(texte: unknown): number | null {
  return analyserPourcentage(texte).valeur;
}
