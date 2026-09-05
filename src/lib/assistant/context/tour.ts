/**
 * LE CONTEXTE DU TOUR VOYAGE AVEC LE MESSAGE, PAS DANS LE PRÉFIXE.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────────────────────
 *
 * Le cache de prompt du fournisseur ne sert que le PRÉFIXE identique d'une requête à l'autre :
 * consignes, outils, puis l'historique. Tout ce qui change à chaque message — entités actives
 * du fil, plan de la question, indice d'action native, mémoire personnelle, actions récentes —
 * vivait à la FIN des consignes. Résultat mesuré : environ la moitié des jetons d'entrée
 * repayés au plein tarif à chaque tour, outils compris, parce qu'un mot changé dans les
 * consignes rendait tout ce qui suit non cachable.
 *
 * Ces blocs sont désormais ajoutés au DERNIER message de l'utilisateur, sous une marque qui dit
 * d'où ils viennent : le préfixe (consignes stables + outils + historique) reste identique, et
 * seul le message courant est neuf. Le modèle reçoit exactement la même information.
 */
export const MARQUE_CONTEXTE_TOUR = "[CONTEXTE DU TOUR — fourni par le système, pas écrit par l'utilisateur]";

export function composerContexteTour(blocs: ReadonlyArray<string | null | undefined>): string {
  const utiles = blocs.map((b) => (b ?? "").trim()).filter(Boolean);
  if (utiles.length === 0) return "";
  return `\n\n${MARQUE_CONTEXTE_TOUR}\n${utiles.join("\n\n")}`;
}

/** La question NUE, si un contexte de tour lui a été accolé — pour les journaux et la mémoire. */
export function questionSansContexte(contenu: string): string {
  const i = contenu.indexOf(MARQUE_CONTEXTE_TOUR);
  return i < 0 ? contenu : contenu.slice(0, i).trimEnd();
}
