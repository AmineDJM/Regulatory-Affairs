/**
 * LE BON DE VERSEMENT — la porte qui précède la déclaration aux autorités.
 *
 * ── LE GESTE RÉEL, EN DEUX TEMPS ────────────────────────────────────────────────────────────
 *
 * On ne déclare pas un événement aux autorités sans avoir versé la taxe, et sans la QUITTANCE en
 * main : c'est ce papier qu'on dépose au guichet. Deux marches, et l'ordre compte :
 *
 *   1. **LE BON EST ACCORDÉ.** Le PRIM demande le versement (montant attendu, note, pièces) et
 *      trois signatures répondent : son N+1, le chef de produit du dossier, puis le centre de
 *      validations (Directeur Général, à défaut Super Admin).
 *   2. **LA QUITTANCE EST PAYÉE.** Le bon accordé, le PRIM demande le paiement de la quittance —
 *      le montant RÉEL, qui n'est pas toujours celui annoncé — et cette demande emprunte le
 *      circuit commun : centre de paiement, puis Finances. Elles règlent, scannent la quittance
 *      et la REMETTENT à son bureau. La déclaration s'ouvre à ce moment-là, pas avant.
 *
 * ── POURQUOI LA VALIDATION AVANT LE PAIEMENT, ET NON L'INVERSE ──────────────────────────────
 *
 * Le PRIM déposait auparavant une demande de PAIEMENT directement. Le principe même du versement
 * n'était donc jamais discuté : le centre de paiement se retrouvait à autoriser un décaissement
 * dont personne, en amont, n'avait dit qu'il était dû. Refuser à ce stade coûte cher — le dossier
 * est déjà instruit, et le refus se lit comme un désaveu comptable alors qu'il porte sur le fond.
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
  | "A_DEMANDER"           // rien n'a été demandé
  | "EN_VALIDATION"        // le bon est demandé, les trois signatures sont en cours
  | "VALIDATION_A_REVOIR"  // un validateur a demandé une modification
  | "VALIDATION_REFUSEE"   // un validateur a refusé le principe du versement
  | "QUITTANCE_A_DEMANDER" // le bon est ACCORDÉ : reste à demander le paiement de la quittance
  | "AU_CENTRE"            // quittance demandée, en attente du centre de paiement
  | "RENVOYE"              // le centre a rendu la main au demandeur (révision / argumentation)
  | "REFUSE"               // le centre a refusé
  | "AUX_FINANCES"         // autorisé, pas encore réglé
  | "PAYE"                 // réglé, quittance pas encore remise au PRIM
  | "REMIS"                // quittance remise au bureau du PRIM → la déclaration s'ouvre
  | "SANS_BV";             // le PRIM a déclaré qu'aucun versement n'est dû

export interface BvInput {
  /** La demande de VALIDATION du bon existe-t-elle ? */
  validationId: string | null;
  /** État de cette validation (`ValidationStatus`), ou null. */
  validationStatus: string | null;
  /** La demande de paiement de la QUITTANCE existe-t-elle ? */
  requestId: string | null;
  /** État de l'ordre au centre de paiement (`CentralStatus`), ou null si l'ordre n'existe pas. */
  centralStatus: string | null;
  /** État de l'ordre de dépense (`ExpenseOrderStatus`), ou null. */
  orderStatus: string | null;
  deliveredAt: Date | null;
  skippedAt: Date | null;
}

export function bvStage(i: BvInput): BvStage {
  // Les deux ISSUES priment sur tout le reste : une fois la quittance remise (ou le dossier
  // déclaré sans versement), l'état des circuits ne rouvre plus la question.
  if (i.deliveredAt) return "REMIS";
  if (i.skippedAt) return "SANS_BV";

  // LA QUITTANCE PASSE AVANT LA VALIDATION DANS LA LECTURE — parce qu'elle ne peut exister
  // qu'après elle. Les dossiers ouverts AVANT que cette marche existe n'ont pas de validation :
  // les renvoyer à « à demander » leur ferait recommencer un circuit déjà instruit.
  if (i.requestId) {
    switch (i.centralStatus) {
      case "REFUSED": return "REFUSE";
      case "CHANGES_REQUESTED":
      case "INFO_REQUESTED": return "RENVOYE";
      case "AWAITING": return "AU_CENTRE";
      default: break;
    }
    // Autorisé (ou hérité d'avant le guichet unique) : reste l'état du règlement.
    return i.orderStatus === "PAID" ? "PAYE" : "AUX_FINANCES";
  }

  if (!i.validationId) return "A_DEMANDER";
  switch (i.validationStatus) {
    case "REJECTED": return "VALIDATION_REFUSEE";
    case "CHANGES_REQUESTED": return "VALIDATION_A_REVOIR";
    case "APPROVED": return "QUITTANCE_A_DEMANDER";
    default: return "EN_VALIDATION";
  }
}

/** La déclaration aux autorités est-elle ouverte ? */
export function bvUnlocksAuthorities(i: BvInput): boolean {
  const s = bvStage(i);
  return s === "REMIS" || s === "SANS_BV";
}

/** Les Finances peuvent-elles remettre la quittance ? Seulement une fois réglée, et une seule fois. */
export function bvCanDeliver(i: BvInput): boolean {
  return bvStage(i) === "PAYE";
}

/**
 * Le PRIM peut-il (re)demander le BON ? Tant qu'aucune demande n'est en cours ni accordée.
 *
 * Un refus rouvre la porte : le validateur a dit ce qui manquait, et redemander avec ce qu'il
 * attend est exactement ce qu'on veut. Une demande À REVOIR, elle, ne se REDEMANDE pas — elle se
 * modifie dans son propre circuit, et en ouvrir une seconde laisserait deux demandes vivantes
 * pour un seul bon.
 */
export function bvCanRequest(i: BvInput): boolean {
  const s = bvStage(i);
  return s === "A_DEMANDER" || s === "VALIDATION_REFUSEE";
}

/**
 * Le PRIM peut-il demander le paiement de la QUITTANCE ?
 *
 * Seulement une fois le bon ACCORDÉ. C'est toute la raison d'être de la première marche : sans
 * cette garde, on pourrait engager l'argent avant que quiconque ait dit que le versement est dû.
 *
 * Un REFUS du centre de paiement rouvre cette porte, et elle seule : le bon reste accordé — ce
 * qui a été refusé, c'est ce règlement-ci. Renvoyer le pharmacien à la première marche lui
 * ferait refaire trois signatures pour un montant à corriger.
 */
export function bvCanRequestQuittance(i: BvInput): boolean {
  const s = bvStage(i);
  return s === "QUITTANCE_A_DEMANDER" || s === "REFUSE";
}

const LIBELLES: Record<BvStage, string> = {
  A_DEMANDER: "Bon de versement à demander",
  EN_VALIDATION: "Bon en cours de validation",
  VALIDATION_A_REVOIR: "Bon à revoir — un validateur a demandé une modification",
  VALIDATION_REFUSEE: "Bon refusé en validation",
  QUITTANCE_A_DEMANDER: "Bon accordé — quittance à demander",
  AU_CENTRE: "Quittance au centre de paiement",
  RENVOYE: "Le centre a rendu la main",
  REFUSE: "Refusé par le centre de paiement",
  AUX_FINANCES: "Autorisé — en attente de règlement",
  PAYE: "Réglé — quittance à remettre au bureau du PRIM",
  REMIS: "Quittance remise au bureau du PRIM",
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
      return "La déclaration aux autorités s'ouvrira une fois le bon de versement accordé, la quittance réglée et remise à votre bureau. Demandez le bon ci-dessous — ou dites que ce dossier n'en appelle aucun.";
    case "EN_VALIDATION":
      return "Le bon est en validation : votre responsable, le chef de produit, puis le centre de validations (Directeur Général). Rien à faire de votre côté tant qu'ils n'ont pas signé.";
    case "VALIDATION_A_REVOIR":
      return "Un validateur demande une modification : lisez son commentaire dans la demande de validation et reprenez-la là-bas — n'en ouvrez pas une seconde.";
    case "VALIDATION_REFUSEE":
      return "Le principe de ce versement a été refusé. Lisez le motif, puis redemandez le bon avec ce que le validateur attend.";
    case "QUITTANCE_A_DEMANDER":
      return "Le bon est accordé. Demandez maintenant le paiement de la quittance en indiquant son montant réel : la demande partira au centre de paiement, puis aux Finances.";
    case "AU_CENTRE":
      return "La demande de paiement est au centre de paiement (PDG / Super Admin). Rien à faire de votre côté tant qu'il n'a pas tranché.";
    case "RENVOYE":
      return "Le centre de paiement a rendu la main au demandeur : répondez dans le fil de la demande et resoumettez.";
    case "REFUSE":
      return "Le centre de paiement a refusé ce règlement. Lisez son motif dans le fil, puis redemandez avec ce qu'il attend.";
    case "AUX_FINANCES":
      return "Autorisé par le centre. Les Finances doivent régler, puis scanner la quittance et la déposer à votre bureau.";
    case "PAYE":
      return "Réglé. Les Finances doivent maintenant scanner la quittance et la remettre à votre bureau — c'est cette remise qui ouvre la déclaration.";
    case "REMIS":
      return "La quittance vous a été remise : vous pouvez déclarer aux autorités.";
    case "SANS_BV":
      return "Ce dossier a été déclaré sans versement : la déclaration aux autorités est ouverte.";
  }
}
