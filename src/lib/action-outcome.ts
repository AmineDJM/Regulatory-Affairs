/**
 * CE QU'ON DIT QUAND UNE ACTION SERVEUR NE REVIENT PAS COMME PRÉVU.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Le même patron était recopié dans sept écrans :
 *
 *     setSaving(true);
 *     const r = await fn();     // ← si `fn` LÈVE, la ligne suivante n'existe pas
 *     setSaving(false);
 *
 * Une action qui lève — erreur base, stockage injoignable, déploiement en cours, connexion
 * coupée — laisse donc `saving` à vrai POUR TOUJOURS : le bouton tourne, aucun message
 * n'apparaît, et la personne conclut que rien ne s'est enregistré. C'est le symptôme rapporté
 * (« ça tourne tourne tourne »).
 *
 * Le piège est plus vicieux qu'un bouton bloqué : plusieurs de ces actions ENREGISTRENT D'ABORD
 * puis font le lent (pièces jointes, journal, notifications). L'objet était donc souvent bien
 * créé — mais l'écran ne le disait jamais, on recommençait, et l'on obtenait des DOUBLONS. C'est
 * pourquoi le message n'invite JAMAIS à réessayer : il demande d'aller vérifier d'abord.
 *
 * Module PUR : la phrase est une décision de produit, elle se lit et se teste sans navigateur.
 */

/** Ce qui a empêché l'action d'aboutir — au-delà d'un refus métier, qui porte son propre message. */
export type ActionFailure =
  /** L'action a levé : le serveur a répondu, mais mal. */
  | "THROWN"
  /** L'action n'a jamais répondu : requête suspendue, conteneur redémarré. */
  | "TIMEOUT";

/**
 * LA PHRASE, et pourquoi elle est formulée ainsi.
 *
 * Trois exigences, dans cet ordre : dire que ce n'est PAS un refus métier (la personne n'a rien
 * fait de mal), dire que l'enregistrement a PU aboutir, et interdire le réflexe de recommencer.
 * « Réessayez » serait le pire conseil possible ici — c'est celui qui fabrique les doublons.
 */
export function actionFailureMessage(kind: ActionFailure): string {
  const commun = "Vérifiez d'abord la liste : l'enregistrement a pu aboutir, et un second envoi créerait un doublon.";
  return kind === "TIMEOUT"
    ? `Le serveur n'a pas répondu. ${commun}`
    : `L'enregistrement n'a pas abouti (connexion ou serveur). ${commun}`;
}

/**
 * Au bout de combien de temps on rend la main.
 *
 * 45 secondes : au-delà, plus personne n'attend un formulaire sans se demander si c'est cassé —
 * et en deçà, on couperait des enregistrements lents mais valides (un lot de pièces jointes
 * volumineuses sur une connexion médiocre).
 */
export const ACTION_TIMEOUT_MS = 45_000;
