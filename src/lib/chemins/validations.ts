/**
 * OÙ MÈNE UNE NOTIFICATION DE VALIDATION — écrit une fois.
 *
 * Le VALIDATEUR tranche dans la liste (`/validations`) : la fiche `/validations/<id>` montre la
 * demande, ses pièces et son fil, mais n'a PAS les boutons de décision. On l'envoie donc sur SA
 * carte, mise en tête et entourée (`?focus=<étape>`), l'ancre la faisant défiler jusqu'à elle.
 * Le DEMANDEUR, les participants et ceux qui suivent le fil vont sur la fiche.
 *
 * Module PUR — aucune importation.
 */

export const CHEMIN_VALIDATIONS = "/validations";

/** La carte de décision d'une étape, dans la liste du validateur. */
export function lienEtapeAValider(stepId: string): string {
  const e = encodeURIComponent(stepId);
  return `${CHEMIN_VALIDATIONS}?focus=${e}#val-${e}`;
}

/** La fiche d'une demande de validation (circuit, pièces, fil). */
export function lienDemandeDeValidation(id: string): string {
  return `${CHEMIN_VALIDATIONS}/${encodeURIComponent(id)}`;
}
