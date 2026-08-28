/**
 * NORMALISATIONS DE TEXTE pour la désignation d'objets — module PUR, sans aucun import.
 *
 * Il est séparé parce que le workspace (un composant `"use client"`) désigne les mêmes objets
 * que le serveur : mettre ces fonctions dans un module qui lit des fichiers ferait échouer la
 * compilation du navigateur avec « Module not found: Can't resolve 'fs' ». Voir CLAUDE.md,
 * « Frontière client / serveur ».
 */

/**
 * Replie accents, casse et espaces multiples. C'est ce qui permet à « remuneration » dicté à la
 * volée d'atteindre « Rémunération » — et le contraire ferait échouer la moitié des instructions
 * vocales sans que personne comprenne pourquoi.
 */
export function normaliserTexte(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Coupe proprement à `max` caractères, sur un mot quand c'est possible. */
export function abreger(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${espace > max * 0.6 ? coupe.slice(0, espace) : coupe}…`;
}

/** Le mot « paragraphe » au bon nombre — les messages d'erreur se lisent par des humains. */
export const pluriel = (n: number, singulier: string, plur = `${singulier}s`): string =>
  `${n} ${n > 1 ? plur : singulier}`;
