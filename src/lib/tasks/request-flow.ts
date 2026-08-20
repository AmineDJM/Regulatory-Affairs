/**
 * DEMANDER UNE TÂCHE À QUELQU'UN — le parcours en entier, en un seul endroit.
 *
 * Le circuit tient en trois gestes : on DEMANDE, l'autre ACCEPTE ou REFUSE, puis il FAIT et
 * VALIDE son travail. C'est tout.
 *
 * Ce qui a été retiré compte autant que ce qui reste. Une demande acceptée ne repasse pas par
 * « Démarrer », ni par « Mettre dans un projet » : ces étapes n'apprennent rien à personne et
 * font qu'une tâche acceptée reste affichée « à faire » pendant deux semaines parce que
 * personne n'a cliqué sur le bouton du milieu. Accepter, c'est commencer.
 *
 * Le refus se dit avec un motif FACULTATIF. Rendre le motif obligatoire ne produit pas de
 * meilleures raisons — il produit des « non » et des « pas dispo », et transforme un refus
 * légitime en formalité désagréable.
 *
 * Le travail validé reste MODIFIABLE. On valide en fin de journée, on retrouve une pièce le
 * lendemain : si valider fermait la porte, la pièce partirait par message et le dossier
 * resterait faux.
 *
 * Module PUR — testé, sans base de données.
 */

export interface TaskLike {
  status: string;
  /** Non nul = née d'une demande faite à quelqu'un (et non créée directement). */
  requestedAt?: string | Date | null;
  assignedToId?: string | null;
  createdById?: string | null;
  participantIds?: string[];
  readerIds?: string[];
}

/** Née d'une demande faite à quelqu'un — par opposition à une tâche qu'on s'est donnée. */
export function isRequest(t: TaskLike): boolean {
  return Boolean(t.requestedAt) || t.status === "REQUESTED" || t.status === "DECLINED";
}

/** En attente de la réponse du destinataire. */
export function awaitingResponse(t: TaskLike): boolean {
  return t.status === "REQUESTED";
}

/** Seul le DESTINATAIRE répond. Ni le demandeur, ni la direction : accepter à la place de
 *  quelqu'un, c'est lui attribuer un engagement qu'il n'a pas pris. */
export function canRespond(t: TaskLike, userId: string): boolean {
  return awaitingResponse(t) && t.assignedToId === userId;
}

/**
 * Qui FAIT le travail : le responsable et les participants. Le demandeur suit, la direction
 * voit — mais valider le travail d'autrui reviendrait à signer à sa place.
 */
export function canDoWork(t: TaskLike, userId: string): boolean {
  if (t.status === "REQUESTED" || t.status === "DECLINED" || t.status === "CANCELLED") return false;
  return t.assignedToId === userId || (t.participantIds ?? []).includes(userId);
}

/** Le cercle de la tâche : qui a le droit d'ouvrir le dossier et d'en lire les pièces. */
export function canSee(t: TaskLike, userId: string, globalView = false): boolean {
  if (globalView) return true;
  return (
    t.assignedToId === userId ||
    t.createdById === userId ||
    (t.participantIds ?? []).includes(userId) ||
    (t.readerIds ?? []).includes(userId)
  );
}

/** Qui peut joindre une pièce : ceux qui font le travail, et le demandeur (il complète sa demande). */
export function canAttach(t: TaskLike, userId: string): boolean {
  return canDoWork(t, userId) || t.createdById === userId;
}

/**
 * LES BOUTONS PROPOSÉS, ET RIEN D'AUTRE.
 *
 * `respond`  — accepter / refuser (destinataire, demande en attente)
 * `open`     — entrer dans la demande pour y travailler
 * `start`    — « Démarrer » : réservé aux tâches ORDINAIRES, jamais aux demandes acceptées
 * `complete` — terminer une tâche ordinaire d'un clic depuis la liste
 * `dossier`  — ouvrir un projet à partir de la tâche : ordinaire uniquement
 */
export type TaskAction = "respond" | "open" | "start" | "complete" | "dossier";

export function taskActions(
  t: TaskLike,
  userId: string,
  opts: { canCreateDossier?: boolean; readOnly?: boolean } = {},
): TaskAction[] {
  if (opts.readOnly) return [];

  if (isRequest(t)) {
    // Le parcours d'une demande, du début à la fin — sans jamais de « Démarrer ».
    if (awaitingResponse(t)) return canRespond(t, userId) ? ["respond", "open"] : ["open"];
    if (t.status === "DECLINED" || t.status === "CANCELLED") return ["open"];
    return ["open"];
  }

  const mine = t.assignedToId === userId || t.createdById === userId || (t.participantIds ?? []).includes(userId);
  if (!mine) return [];
  const out: TaskAction[] = [];
  if (t.status === "TODO") out.push("start");
  if (t.status !== "DONE") out.push("complete");
  if (opts.canCreateDossier) out.push("dossier");
  return out;
}

/** Où en est une demande, dit comme on le dirait à l'oral. */
export function requestStage(t: TaskLike): string {
  if (t.status === "REQUESTED") return "En attente de réponse";
  if (t.status === "DECLINED") return "Refusée";
  if (t.status === "CANCELLED") return "Annulée";
  if (t.status === "DONE") return "Travail validé";
  return "Acceptée — en cours";
}

/**
 * Le statut d'une demande ACCEPTÉE.
 *
 * `IN_PROGRESS` et non `TODO` : accepter, c'est prendre en charge. Laisser la demande en
 * « à faire » obligerait à un second clic qui n'apprend rien, et c'est exactement l'étape
 * intermédiaire qu'on supprime ici.
 */
export const ACCEPTED_STATUS = "IN_PROGRESS";
export const DECLINED_STATUS = "DECLINED";

/** Le motif du refus, tel qu'on l'affiche au demandeur. Sans motif, on le dit aussi. */
export function declineSummary(reason: string | null | undefined): string {
  const clean = (reason ?? "").trim();
  return clean ? `Refusée — ${clean}` : "Refusée, sans motif précisé.";
}

/** L'intitulé du bouton de validation : on ne valide qu'une fois, ensuite on met à jour. */
export function submitLabel(t: TaskLike): string {
  return t.status === "DONE" ? "Mettre à jour mon travail" : "Valider mon travail";
}
