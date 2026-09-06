/**
 * LE BAC À SABLE D'EXÉCUTION (mandat 4 §25) — la façade.
 *
 * Quatre briques, une doctrine : ANALYSER n'est jamais ÉCRIRE. Le SQL est en lecture seule et
 * borné à une liste blanche relue dans le PLAN ; le JavaScript tourne dans un fil isolé au
 * contexte vide ; le Python dans un processus aux limites posées par le noyau — et déclaré
 * absent quand il l'est ; les opérations d'analyse sont pures et fermées ; la visualisation
 * recommande et DIT ce qui tromperait. Rien ici ne touche la production : ce que la personne
 * obtient est une réponse, jamais un effet.
 *
 * Les droits ne vivent pas ici : le SQL exige la vue globale (vérifiée dans `sql.ts`), et les
 * données d'entrée du code arrivent d'un outil de lecture ou d'un fichier du Drive vérifiés
 * par le pont (`platform/in-process/sandbox/`).
 */

export * from "@/lib/sandbox/analyse";
export * from "@/lib/sandbox/viz";
export * from "@/lib/sandbox/sql";
export * from "@/lib/sandbox/js";
export * from "@/lib/sandbox/python";
