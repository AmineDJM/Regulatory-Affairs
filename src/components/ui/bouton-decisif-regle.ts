/**
 * LA RÈGLE DU BOUTON DÉCISIF — pure, sans import (le bouton client et ses bancs la lisent).
 *
 * Un geste qui tranche, engage de l'argent, signe, émet, paie ou supprime se confirme d'un SECOND
 * clic : le premier transforme le bouton en « Confirmer : <action> ? », le second (dans le délai)
 * exécute, sinon le bouton revient à son état initial. Aucune fenêtre du navigateur : un
 * `window.confirm` bloque l'onglet, ne se stylise pas, et se valide à l'aveugle à la touche Entrée.
 *
 * La mécanique tient en une fonction (`gesteDuClic`) pour qu'un banc puisse l'éprouver sans
 * navigateur : le dépôt n'a ni jsdom ni happy-dom, et le composant n'est qu'une couche mince autour.
 */

/** Le délai pendant lequel le second clic confirme. Au-delà, le bouton redevient ce qu'il était. */
export const DELAI_CONFIRMATION_MS = 5_000;

export type GesteDuClic =
  /** Bouton désactivé : on ne fait rien, armé ou non. */
  | "rien"
  /** Le formulaire porteur a un champ invalide (un motif `required` vide) : on le signale AVANT
   *  d'armer — confirmer un geste que le navigateur refusera ensuite ferait cliquer pour rien. */
  | "signalerFormulaire"
  /** Premier clic : le bouton passe en « Confirmer : … ? », rien n'est soumis ni exécuté. */
  | "armer"
  /** Second clic dans le délai : on laisse partir la soumission et l'`onClick` d'origine. */
  | "executer";

export function gesteDuClic(etat: { arme: boolean; desactive: boolean; formulaireInvalide: boolean }): GesteDuClic {
  if (etat.desactive) return "rien";
  if (etat.formulaireInvalide) return "signalerFormulaire";
  return etat.arme ? "executer" : "armer";
}

/** Le texte visible d'un contenu React (chaînes, nombres, tableaux, éléments et leurs enfants). */
export function texteDesEnfants(noeud: unknown): string {
  if (noeud === null || noeud === undefined || typeof noeud === "boolean") return "";
  if (typeof noeud === "string" || typeof noeud === "number") return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(texteDesEnfants).join("");
  if (typeof noeud === "object" && "props" in (noeud as object)) {
    const props = (noeud as { props?: { children?: unknown } }).props;
    return texteDesEnfants(props?.children);
  }
  return "";
}

/**
 * « Confirmer : <action> ? ». L'action est `confirmation` si l'appelant la nomme, sinon le texte du
 * bouton (sans les points de suspension d'un libellé qui ouvre un panneau, ni la ponctuation finale).
 */
export function libelleConfirmation(confirmation: string | undefined, enfants: unknown): string {
  const brut = (confirmation ?? texteDesEnfants(enfants)).replace(/\s+/g, " ").trim().replace(/[\s.…:!?]+$/u, "").trim();
  return `Confirmer : ${brut || "cette action"} ?`;
}

/** Ce qu'annonce la zone vivante quand le bouton est armé (lecteur d'écran). */
export function annonceArme(libelle: string, delaiMs: number = DELAI_CONFIRMATION_MS): string {
  return `${libelle} Cliquez de nouveau dans les ${Math.round(delaiMs / 1000)} secondes pour confirmer, ou appuyez sur Échap pour annuler.`;
}
