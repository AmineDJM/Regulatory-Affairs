/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RETIRER UNE DEMANDE DE VALIDATION TANT QU'ELLE N'EST PAS TRANCHÉE (décision de la Direction, 04/10).
 *
 * « On annule sa demande tant que l'autre ne l'a pas exécutée. » Une demande de validation n'est
 * EXÉCUTÉE que lorsqu'elle est tranchée — validée ou refusée. Avant, il suffisait qu'UN validateur
 * d'un circuit à trois étapes ait dit oui pour que le demandeur ne puisse plus rien : il voyait
 * partir chez le deuxième une demande devenue sans objet. Un accord d'étape est un fait, et il
 * RESTE — c'est pourquoi la demande se CLÔT (annulée, son fil et ses étapes intacts) au lieu de
 * s'effacer : seule une demande VIERGE (première version, personne ne s'est prononcé) s'efface.
 *
 * Deux appelants, une règle : `deleteMyValidationRequest` (la fiche d'une validation) et
 * `cancelAttachmentValidation` (la validation d'une pièce du secrétariat). Module PUR — l'écran lit
 * la même règle que l'action (§118.83).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface DemandePourRetrait {
  status: string;
  version: number;
  /** La demande se corrige-t-elle sur elle-même (`resoumissionSurPlace`) ? */
  surPlace: boolean;
  steps: { status: string }[];
}

/** Pourquoi la demande ne se retire PAS — `null` si elle se retire. */
export function refusDuRetraitValidation(d: DemandePourRetrait): string | null {
  if (d.status === "CHANGES_REQUESTED") {
    return d.surPlace ? null : "Cette demande se corrige depuis son objet d'origine : c'est lui qui la renvoie ou la clôt.";
  }
  if (d.status === "CANCELLED") return "Cette demande est déjà retirée.";
  if (d.status !== "PENDING") return "Cette demande a été tranchée : l'accord ou le refus d'un tiers ne s'efface pas.";
  return null;
}

/** Une demande VIERGE s'efface ; toute autre se CLÔT, son historique intact. */
export function retraitEfface(d: DemandePourRetrait): boolean {
  return d.status === "PENDING" && d.version <= 1 && d.steps.every((e) => e.status === "PENDING");
}

export interface EtapeSollicitee {
  validatorId: string;
  order: number;
  status: string;
}

/**
 * QUI A DÉJÀ ÉTÉ SOLLICITÉ — et doit donc apprendre que la demande est retirée : ceux qui se sont
 * prononcés, et ceux chez qui elle attend (en parallèle, tous ; en séquentiel, jusqu'à l'étape
 * active). Un validateur qu'elle n'a jamais atteint n'a rien à apprendre : le prévenir serait du
 * bruit sur une demande qu'il n'a jamais vue (§118.32). Jamais l'auteur du retrait.
 */
export function validateursSollicites(
  d: { mode: string; currentOrder: number; steps: EtapeSollicitee[] },
  auteurId: string,
): string[] {
  const ids = d.steps
    .filter((e) => e.status !== "PENDING" || d.mode === "PARALLEL" || e.order <= d.currentOrder)
    .map((e) => e.validatorId)
    .filter((id) => id !== auteurId);
  return [...new Set(ids)];
}
