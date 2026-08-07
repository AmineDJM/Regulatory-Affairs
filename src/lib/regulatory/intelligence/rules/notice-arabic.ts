/**
 * NOTICE EN ARABE — contrôle spécifiquement ALGÉRIEN, absent des référentiels ICH/EMA.
 *
 * La réglementation algérienne (décret exécutif n° 92-286, art. 4) impose que la notice et
 * l'étiquetage soient rédigés **en arabe** (le français en sus). Un dossier dont le module 1.3
 * ne contient que du français passe tous les contrôles européens… et revient de l'ANPP avec une
 * réserve certaine. C'est exactement le genre d'oubli qu'une machine repère mieux qu'un œil
 * pressé : compter les caractères ne fatigue jamais.
 *
 * Périmètre volontairement PRUDENT :
 *   • seules les sections 1.3.x HORS 1.3.1 sont visées (le RCP — 1.3.1 — est un document
 *     technique pour professionnels, usuellement accepté en français) ;
 *   • seuls les documents à TEXTE NATIF sont jugés : l'OCR latin rend l'arabe en bouillie de
 *     caractères, et l'on refuse d'accuser une notice arabe scannée sur une lecture ratée ;
 *   • en dessous d'un volume minimal de lettres, on ne juge pas — un fichier quasi vide n'est
 *     pas une preuve d'absence.
 *
 * Module PUR : le comptage doit être testable sans base ni PDF.
 */

/** En dessous de ce volume de lettres, le texte ne permet pas de juger. */
export const MIN_LETTERS = 400;

/** Part minimale de caractères arabes pour considérer qu'une version arabe existe. */
export const MIN_ARABIC_RATIO = 0.05;

// Lettres arabes : bloc principal + supplément + formes de présentation (PDF exportés).
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
// Lettres latines (accents compris) — le dénominateur : ce qui est effectivement écrit.
const LATIN_RE = /[A-Za-zÀ-ɏ]/g;

/** Part de caractères arabes parmi les LETTRES du texte (0..1) + volume total de lettres. */
export function arabicStats(text: string): { ratio: number; letters: number } {
  const arabic = (text.match(ARABIC_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  const letters = arabic + latin;
  return { ratio: letters === 0 ? 0 : arabic / letters, letters };
}

/**
 * Vrai si le texte est assez volumineux pour être jugé ET ne contient pas de version arabe.
 * Faux dans le doute — un contrôle réglementaire n'accuse jamais sur un indice fragile.
 */
export function missesArabic(text: string): boolean {
  const { ratio, letters } = arabicStats(text);
  return letters >= MIN_LETTERS && ratio < MIN_ARABIC_RATIO;
}

/** Sections du module 1.3 concernées par l'obligation d'arabe (notice, étiquetage, maquettes). */
export function isArabicRequiredSection(code: string | null | undefined): boolean {
  if (!code) return false;
  return code.startsWith("1.3") && !code.startsWith("1.3.1");
}
