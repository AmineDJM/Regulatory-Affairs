/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉCISION D'UNE ÉTAPE ET LA REPRISE D'UNE DEMANDE RENVOYÉE — règles PURES (audit 360°, R08).
 *
 * « Modification demandée » CLÔTURAIT la demande de validation : le demandeur ne pouvait que la
 * laisser là et en écrire une autre, sans que rien relie la seconde à la première ni au motif qui
 * l'avait fait renvoyer. La règle commune des circuits est désormais tenue ici aussi : à chaque
 * étape, VALIDER, RENVOYER POUR CORRECTION (motif exigé) ou REFUSER (motif exigé) ; une demande
 * renvoyée se corrige et se RESOUMET sur elle-même, et le circuit reprend à l'étape qui l'a renvoyée.
 *
 * Ces fonctions ne lisent rien : l'action les appelle SOUS LE VERROU de la demande, sur des étapes
 * RELUES après l'écriture — c'est ce qui fait qu'en mode parallèle, deux validateurs qui approuvent
 * à la même seconde ne laissent plus une demande en attente pour toujours (chacun voyait l'autre
 * encore « en attente », aucun ne finalisait, et plus personne ne pouvait trancher).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type DecisionEtape = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
export type StatutDemande = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface EtapeVue {
  id: string;
  order: number;
  status: string;
}

export interface DemandeVue {
  mode: "SEQUENTIAL" | "PARALLEL" | string;
  currentOrder: number;
  steps: EtapeVue[];
}

/** Refuser ou renvoyer sans dire pourquoi laisse le demandeur deviner ce qu'il doit corriger. */
export function motifExige(decision: DecisionEtape): boolean {
  return decision !== "APPROVED";
}

export const MOTIF_EXIGE =
  "Indiquez le motif : sans lui, le demandeur ne sait pas quoi corriger — et l'historique ne dira pas pourquoi la demande a été arrêtée.";

/**
 * CE QUE DEVIENT LA DEMANDE quand l'étape `stepId` vient d'être tranchée — lu sur les étapes RELUES,
 * où cette étape porte déjà sa décision.
 *
 * Un refus ou un renvoi s'appliquent à toute la demande. Un accord la fait avancer : en parallèle,
 * elle n'est validée que quand TOUTES les étapes le sont ; en séquentiel, elle passe à l'étape
 * suivante encore en attente, et n'est validée qu'au bout du circuit.
 */
export function issueDeLaDecision(
  demande: DemandeVue,
  stepId: string,
  decision: DecisionEtape,
): { status: StatutDemande; currentOrder: number; suivanteId: string | null } {
  if (decision === "REJECTED") return { status: "REJECTED", currentOrder: demande.currentOrder, suivanteId: null };
  if (decision === "CHANGES_REQUESTED") return { status: "CHANGES_REQUESTED", currentOrder: demande.currentOrder, suivanteId: null };
  if (demande.mode === "PARALLEL") {
    const toutes = demande.steps.every((e) => (e.id === stepId ? true : e.status === "APPROVED"));
    return { status: toutes ? "APPROVED" : "PENDING", currentOrder: demande.currentOrder, suivanteId: null };
  }
  const suivante = demande.steps.find((e) => e.order === demande.currentOrder + 1 && e.status === "PENDING");
  return suivante
    ? { status: "PENDING", currentOrder: demande.currentOrder + 1, suivanteId: suivante.id }
    : { status: "APPROVED", currentOrder: demande.currentOrder, suivanteId: null };
}

/**
 * LA REPRISE D'UNE DEMANDE RENVOYÉE — quelles étapes rouvrir, et où reprend le circuit.
 *
 * Le circuit reprend À L'ÉTAPE QUI A RENVOYÉ : la personne qui a demandé la correction juge la
 * correction, et un accord déjà donné avant elle reste acquis. Sauf quand le MONTANT monte : un
 * accord ne couvre pas plus que ce qu'il a vu (la règle du visa d'un BC, §118.187), et toutes les
 * étapes déjà validées repartent alors avec la nouvelle version. Une baisse, elle, ne rouvre rien.
 */
export function repriseApresCorrection(
  demande: DemandeVue,
  montantAvant: number | null,
  montantApres: number | null,
): { aRouvrir: string[]; currentOrder: number; montantReleve: boolean } {
  const montantReleve = montantAvant != null && montantApres != null && montantApres > montantAvant;
  const aRouvrir = demande.steps
    .filter((e) => e.status === "CHANGES_REQUESTED" || (montantReleve && e.status === "APPROVED"))
    .map((e) => e.id);
  const enAttenteApres = demande.steps.filter((e) => aRouvrir.includes(e.id) || e.status === "PENDING");
  const currentOrder = demande.mode === "SEQUENTIAL" && enAttenteApres.length > 0
    ? Math.min(...enAttenteApres.map((e) => e.order))
    : demande.currentOrder;
  return { aRouvrir, currentOrder, montantReleve };
}

/**
 * UNE DEMANDE SE CORRIGE-T-ELLE SUR ELLE-MÊME ? — oui quand rien d'autre ne la porte.
 *
 * Une demande déposée depuis l'écran des validations n'a pas d'objet d'origine : elle EST l'objet,
 * et sa correction (le texte, le montant, les pièces) se fait sur elle. Une demande née d'un autre
 * circuit — un bon de commande, une pièce du secrétariat, une déclaration d'information médicale —
 * se corrige LÀ-BAS, et c'est ce circuit qui la renvoie (souvent par une demande neuve qui clôt la
 * précédente, audit 360° I9). La resoumettre ici contournerait la correction que ce circuit exige :
 * un BC « à revoir » se lève en MODIFIANT le BC, pas en appuyant sur un bouton.
 */
export function resoumissionSurPlace(demande: { entityType: string | null; documentId?: string | null }): boolean {
  return !demande.entityType && !demande.documentId;
}
