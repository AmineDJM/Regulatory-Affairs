/**
 * LE BON DE VERSEMENT — la porte qui précède la déclaration aux autorités.
 *
 * ── LE GESTE RÉEL ───────────────────────────────────────────────────────────────────────────
 *
 * On ne déclare pas un événement aux autorités sans avoir versé la taxe, et sans le BON en main :
 * c'est ce papier qu'on dépose au guichet. Le PRIM demande donc le versement (montant, note,
 * pièces), le centre de paiement autorise, les Finances règlent, puis elles REMETTENT le bon à
 * son bureau. La déclaration s'ouvre à ce moment-là, pas avant.
 *
 * ── POURQUOI LA REMISE, ET NON LE PAIEMENT ──────────────────────────────────────────────────
 *
 * « Payé » ne veut pas dire « le PRIM a le papier ». Déduire l'ouverture du règlement aurait
 * débloqué une déclaration que le pharmacien ne peut pas encore faire — et il aurait cherché
 * longtemps pourquoi son écran l'y autorisait. La remise est un GESTE, posé par les Finances,
 * pas un état calculé.
 *
 * ── POURQUOI UNE PORTE « SANS BV » ──────────────────────────────────────────────────────────
 *
 * Tous les dossiers n'appellent pas un versement, et le jour où cette étape apparaît, tous ceux
 * déjà en cours n'en ont pas. Sans porte de sortie, ils resteraient bloqués pour toujours. Elle
 * est donc TRACÉE et MOTIVÉE : sans le motif, elle deviendrait le contournement ordinaire.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/** Où en est le bon de versement — un seul état à la fois, dans l'ordre du circuit. */
export type BvStage =
  | "A_DEMANDER"      // rien n'a été demandé
  | "AU_CENTRE"       // demandé, en attente du centre de paiement
  | "RENVOYE"         // le centre a rendu la main au demandeur (révision / argumentation)
  | "REFUSE"          // le centre a refusé
  | "AUX_FINANCES"    // autorisé, pas encore réglé
  | "PAYE"            // réglé, pas encore remis au PRIM
  | "REMIS"           // remis au bureau du PRIM → la déclaration s'ouvre
  | "SANS_BV";        // le PRIM a déclaré qu'aucun versement n'est dû

export interface BvInput {
  /** La demande de paiement existe-t-elle ? */
  requestId: string | null;
  /** État de l'ordre au centre de paiement (`CentralStatus`), ou null si l'ordre n'existe pas. */
  centralStatus: string | null;
  /** État de l'ordre de dépense (`ExpenseOrderStatus`), ou null. */
  orderStatus: string | null;
  deliveredAt: Date | null;
  skippedAt: Date | null;
}

export function bvStage(i: BvInput): BvStage {
  // Les deux ISSUES priment sur tout le reste : une fois le bon remis (ou le dossier déclaré
  // sans versement), l'état du circuit de paiement ne rouvre plus la question.
  if (i.deliveredAt) return "REMIS";
  if (i.skippedAt) return "SANS_BV";
  if (!i.requestId) return "A_DEMANDER";

  switch (i.centralStatus) {
    case "REFUSED": return "REFUSE";
    case "CHANGES_REQUESTED":
    case "INFO_REQUESTED": return "RENVOYE";
    case "AWAITING": return "AU_CENTRE";
    default: break;
  }
  // Autorisé (ou hérité d'avant le guichet unique) : reste l'état du règlement.
  if (i.orderStatus === "PAID") return "PAYE";
  return "AUX_FINANCES";
}

/** La déclaration aux autorités est-elle ouverte ? */
export function bvUnlocksAuthorities(i: BvInput): boolean {
  const s = bvStage(i);
  return s === "REMIS" || s === "SANS_BV";
}

/** Les Finances peuvent-elles remettre le bon ? Seulement une fois réglé, et une seule fois. */
export function bvCanDeliver(i: BvInput): boolean {
  return bvStage(i) === "PAYE";
}

/** Le PRIM peut-il (re)demander un BV ? Tant qu'aucune demande n'est en cours ni conclue. */
export function bvCanRequest(i: BvInput): boolean {
  const s = bvStage(i);
  return s === "A_DEMANDER" || s === "REFUSE";
}

const LIBELLES: Record<BvStage, string> = {
  A_DEMANDER: "Bon de versement à demander",
  AU_CENTRE: "Au centre de paiement",
  RENVOYE: "Le centre a rendu la main",
  REFUSE: "Refusé par le centre de paiement",
  AUX_FINANCES: "Autorisé — en attente de règlement",
  PAYE: "Réglé — à remettre au bureau du PRIM",
  REMIS: "Remis au bureau du PRIM",
  SANS_BV: "Sans bon de versement",
};

export function bvStageLabel(s: BvStage): string {
  return LIBELLES[s];
}

/**
 * CE QUE L'ÉCRAN DIT — l'état, et surtout QUI DOIT AGIR. « En attente » sans nom fait relancer
 * la mauvaise personne, ou personne.
 */
export function bvMessage(s: BvStage): string {
  switch (s) {
    case "A_DEMANDER":
      return "La déclaration aux autorités s'ouvrira une fois le bon de versement demandé, réglé et remis à votre bureau. Demandez-le ci-dessous — ou dites que ce dossier n'en appelle aucun.";
    case "AU_CENTRE":
      return "La demande est au centre de paiement (PDG / Super Admin). Rien à faire de votre côté tant qu'il n'a pas tranché.";
    case "RENVOYE":
      return "Le centre de paiement a rendu la main au demandeur : répondez dans le fil de la demande et resoumettez.";
    case "REFUSE":
      return "Le centre de paiement a refusé ce versement. Lisez son motif dans le fil, puis redemandez avec ce qu'il attend.";
    case "AUX_FINANCES":
      return "Autorisé par le centre. Les Finances doivent régler, puis déposer le bon à votre bureau.";
    case "PAYE":
      return "Réglé. Les Finances doivent maintenant remettre le bon à votre bureau — c'est cette remise qui ouvre la déclaration.";
    case "REMIS":
      return "Le bon vous a été remis : vous pouvez déclarer aux autorités.";
    case "SANS_BV":
      return "Ce dossier a été déclaré sans versement : la déclaration aux autorités est ouverte.";
  }
}
