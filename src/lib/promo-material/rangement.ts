/** PUR, zéro import — l'action `rangerDevisPromo` et la fiche du dossier le lisent (§118.204). */

/**
 * LE REFUS D'ÉTAPE DU RANGEMENT — chaque étape dit son remède (§118.30). Lu par l'action ET par la
 * fiche, qui ne propose « Ranger comme devis de… » que là où l'action l'acceptera (§118.83).
 */
export function refusDeRangement(circuitState: string | null): string | null {
  if (circuitState === "QUOTE_REQUESTED") return null;
  if (circuitState === "REVIEW_REQUEST" || circuitState === "QUOTE_TO_REQUEST") {
    return "La demande de devis n'est pas encore partie : ce fichier se range comme devis dès que l'assistante retranscrit les devis.";
  }
  if (circuitState === "REVIEW_REQUESTER") {
    return "Les devis sont au choix du demandeur : qu'il demande une correction de la retranscription (« Demander une correction ») — le dossier revient à l'assistante, qui pourra ranger ce devis.";
  }
  return "Les devis de ce dossier sont arrêtés (validation, exécution ou dossier clos) : ce fichier reste une pièce du dossier.";
}

/**
 * UN FICHIER « DEVIS » DÉPOSÉ À NU SUR UN DOSSIER DU CIRCUIT 2 — refusé (§118.204), en nommant le geste
 * qui le fait entrer au circuit avec son fournisseur. L'ancien circuit (version 1) dépose ses devis comme
 * pièces : il n'est pas concerné. `null` : rien à refuser (dossier inconnu compris — la porte d'accès a déjà jugé).
 */
export function refusDevisLibre(pm: { circuitVersion: number } | null): string | null {
  if (!pm || pm.circuitVersion !== 2) return null;
  return "Un devis se dépose depuis la carte « Devis » de la fiche du dossier, avec son fournisseur choisi dans l'annuaire : il devient alors un devis du circuit (le tableau des devis), sans autre geste.";
}
