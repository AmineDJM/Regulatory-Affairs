/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TRANCHER UNE VALIDATION AU SECRÉTARIAT — la règle, lue par l'action ET par les écrans
 * (lot E5 — audit des managers, M14 et M15).
 *
 * Une approbation (`AdminApproval`) a trois issues : valider, refuser, demander une modification. Les deux
 * dernières renvoient la balle au demandeur — sans motif, il ne sait ni pourquoi on lui dit non, ni quoi
 * corriger. Les boutons partaient d'un clic, sans un mot, et l'action ne l'exigeait pas.
 *
 * Et la décision ne disait pas QUI l'avait prise : le validateur nommé, son intérimaire, l'assistante ou la
 * Direction (droit « Valider » du module) tranchent la même approbation, et la fiche ne montrait que
 * « Validateur : X » — un achat accordé par quelqu'un d'autre se lisait accordé par X.
 *
 * Module PUR (zéro import) : le composant client et l'action serveur lisent la même liste (§118.5).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type DecisionApprobation = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

const DECISIONS: readonly DecisionApprobation[] = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"];

/**
 * Une décision LISIBLE. « PENDING », une faute de frappe, un champ perdu en route : refusés — jamais lus comme
 * un accord (§118.192a), jamais envoyés tels quels à la base, qui les rejetait en erreur brute.
 */
export function estDecisionDApprobation(v: string | null | undefined): v is DecisionApprobation {
  return typeof v === "string" && (DECISIONS as readonly string[]).includes(v);
}

/** Refuser et demander une modification renvoient la balle au demandeur : il doit savoir pourquoi. */
export function exigeMotif(d: DecisionApprobation): boolean {
  return d !== "APPROVED";
}

/**
 * Le refus d'une décision sans motif, avec ce qu'il faut écrire (§118.30) — `null` quand le motif est là,
 * ou n'est pas exigé. Appelé APRÈS les gardes d'état (§118.18). Le motif arrive déjà nettoyé (`fdStr` rend
 * `null` pour un champ vide ou fait d'espaces).
 */
export function refusSansMotif(d: DecisionApprobation, motif: string | null): string | null {
  if (!exigeMotif(d) || motif !== null) return null;
  return d === "REJECTED"
    ? "Dites pourquoi vous refusez : c'est ce que lira le demandeur."
    : "Dites ce qu'il faut modifier : c'est ce que lira le demandeur.";
}

/**
 * ON NE TRANCHE PAS SA PROPRE DEMANDE — la règle des circuits de congé et de formation (`approval-chain.ts` :
 * « personne d'autre ne s'auto-valide »), que l'approbation au secrétariat n'appliquait qu'à l'intérimaire :
 * un détenteur du droit « Valider » — l'assistante de direction, le Directeur des opérations — validait son
 * propre achat. Le sommet garde la main, pour la raison des circuits : il est parfois le seul au-dessus.
 */
export function interditSurSaPropreDemande(a: { estDemandeur: boolean; sommet: boolean }): boolean {
  return a.estDemandeur && !a.sommet;
}

/** Le titre que lit le demandeur — sans abréviation ni énumération brute (§104.17). */
export const LIBELLE_DECISION: Record<DecisionApprobation, string> = {
  APPROVED: "Validation accordée",
  REJECTED: "Validation refusée",
  CHANGES_REQUESTED: "Modification demandée",
};

/** Ce qu'est la parole de celui qui tranche, selon sa décision. */
export function libelleMotif(statut: string): string {
  if (statut === "REJECTED") return "Motif du refus";
  if (statut === "CHANGES_REQUESTED") return "À modifier";
  return "Note";
}

/**
 * QUI A TRANCHÉ, tel que la fiche le dit (M14). `null` tant que rien n'est tranché. Une décision d'avant cet
 * enregistrement — ou dont le compte a été supprimé — n'a pas d'auteur connu : on le DIT, plutôt que de laisser
 * « Validateur : X » se lire comme sa signature.
 */
export function decideurAffiche(a: { status: string; decidedAt: Date | string | null; decidedByName: string | null }): string | null {
  if (a.status === "PENDING" || !a.decidedAt) return null;
  return a.decidedByName ? `Décision prise par ${a.decidedByName}` : "Décision prise — auteur inconnu";
}
