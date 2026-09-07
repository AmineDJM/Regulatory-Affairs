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

/**
 * ASSIGNER À QUELQU'UN D'AUTRE, C'EST DEMANDER — pas déposer une ligne dans sa liste.
 *
 * Il y avait deux portes : « Nouvelle tâche » (qui assignait sans rien demander) et « Demander une
 * tâche » (qui ouvrait le circuit). Personne ne devinait laquelle prendre, et l'on choisissait
 * presque toujours la première : la tâche atterrissait chez l'autre sans qu'il l'ait acceptée,
 * sans échéance négociée, sans endroit où déposer le travail — et le demandeur n'apprenait jamais
 * si elle serait faite.
 *
 * Une seule règle remplace les deux portes : **le destinataire décide de la nature du geste**.
 * Pour soi, c'est une to-do — personne n'a besoin d'accepter ce qu'il s'impose. Pour quelqu'un
 * d'autre, c'est une DEMANDE, qui s'accepte ou se refuse.
 */
export type TaskCreationMode = "self" | "request";

export function taskCreationMode(assignedToId: string | null | undefined, creatorId: string): TaskCreationMode {
  const target = (assignedToId ?? "").trim() || creatorId;
  return target === creatorId ? "self" : "request";
}

/** Le statut de départ selon la nature du geste. */
export const CREATION_STATUS: Record<TaskCreationMode, string> = {
  self: "TODO",
  request: "REQUESTED",
};

export interface TaskNotice {
  userId: string;
  title: string;
  /**
   * Pop-up plein écran, ou simple cloche ?
   *
   * Une demande qui attend une RÉPONSE de vous interrompt : sans cela elle dort dans la cloche
   * derrière quarante autres, et le demandeur attend trois jours une réponse d'une seconde. Un
   * partage en lecture, lui, n'attend rien de personne : l'interrompre pour l'informer
   * apprendrait surtout à fermer les pop-up sans les lire — et la prochaine, celle qui comptait,
   * se fermerait avec.
   */
  popup: boolean;
}

/**
 * QUI EST PRÉVENU À LA CRÉATION, ET COMMENT.
 *
 * Une seule notification par personne, jamais au créateur — être prévenu de ce qu'on vient de
 * faire soi-même n'apprend rien et use la cloche.
 */
export function creationNotices(input: {
  creatorId: string;
  assignedToId: string;
  participantIds?: readonly string[];
  readerIds?: readonly string[];
  mode: TaskCreationMode;
}): TaskNotice[] {
  const out: TaskNotice[] = [];
  const seen = new Set<string>([input.creatorId]);
  const push = (userId: string, title: string, popup: boolean) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    out.push({ userId, title, popup });
  };

  if (input.mode === "request") {
    push(input.assignedToId, "Demande de tâche", true);
  } else {
    // Mode « self » : l'assigné EST le créateur, donc déjà écarté. La boucle ci-dessous suffit.
    push(input.assignedToId, "Nouvelle tâche assignée", false);
  }
  for (const id of input.participantIds ?? []) push(id, "Vous participez à une tâche", false);
  for (const id of input.readerIds ?? []) push(id, "Une tâche vous est partagée (lecture)", false);
  return out;
}

export interface TaskLike {
  status: string;
  /** Dernière relance envoyée par le demandeur — porte l'anti-spam. */
  lastNudgeAt?: string | Date | null;
  /** Combien de fois on a déjà relancé (pour le dire : « 3ᵉ relance »). */
  nudgeCount?: number;
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
 * QUI PEUT COMMENTER : tout le cercle de la tâche — **qui voit peut écrire**.
 *
 * On aurait pu réserver le fil à ceux qui « font » et fermer les simples lecteurs. Ce serait une
 * erreur : on nomme quelqu'un en lecture parce qu'il connaît le sujet, et l'empêcher de dire « le
 * fournisseur a déménagé » le renvoie vers la messagerie — où l'information se perd, séparée de la
 * tâche qu'elle concerne. Commenter n'est pas décider : le statut, lui, reste tenu par `canDoWork`.
 *
 * Une tâche REFUSÉE ou ANNULÉE reste commentable : c'est souvent là qu'on explique pourquoi, et
 * qu'on convient de la suite.
 */
export function canComment(t: TaskLike, userId: string, globalView = false): boolean {
  return canSee(t, userId, globalView);
}

/** Le fil, dit comme on le lit — vide, on l'annonce plutôt que d'afficher un cadre nu. */
export function commentsSummary(count: number): string {
  if (count === 0) return "Aucun échange pour l'instant.";
  return `${count} message${count > 1 ? "s" : ""}`;
}

/**
 * LES BOUTONS PROPOSÉS, ET RIEN D'AUTRE.
 *
 * `respond`  — accepter / refuser (destinataire, demande en attente)
 * `open`     — entrer dans la demande pour y travailler
 * `start`    — « Démarrer » : réservé aux tâches ORDINAIRES, jamais aux demandes acceptées
 * `complete` — terminer une tâche ordinaire d'un clic depuis la liste
 * `dossier`  — ouvrir un projet à partir de la tâche : ordinaire uniquement
 * `relance`  — rappeler sa demande à celui qui ne l'a pas encore traitée (DEMANDEUR seul)
 */
export type TaskAction = "respond" | "open" | "start" | "complete" | "dossier" | "relance";

/**
 * RELANCER — le geste qui manquait, et la raison pour laquelle il est BORNÉ.
 *
 * « Tâches que j'ai demandées » disait où en était chaque demande, et rien de plus : pour
 * rappeler la sienne, il fallait sortir de l'écran et écrire un message — hors de la tâche, là
 * où plus rien ne le compte. La relance rentre donc dans la demande : une notification qui
 * INTERROMPT (comme la demande elle-même : elle attend une réponse), une ligne dans le fil, et
 * un compteur.
 *
 * ── POURQUOI UN DÉLAI, ET POURQUOI CELUI-LÀ ─────────────────────────────────────────────────
 *
 * Un bouton qu'on peut presser trois fois de suite fabrique trois pop-up identiques, et la
 * quatrième — celle qui comptait — se ferme sans être lue. Quatre heures, c'est le temps qu'il
 * faut pour qu'une relance dise quelque chose de neuf : on peut relancer le matin puis en fin
 * de journée, on ne peut pas marteler. Le délai court depuis la DEMANDE elle-même, pas
 * seulement depuis la dernière relance : relancer quelqu'un dans la minute qui suit l'envoi
 * n'est pas une relance, c'est du bruit.
 */
export const RELANCE_DELAI_MS = 4 * 60 * 60 * 1000;

/** Les statuts qui laissent une relance avoir du sens : la demande est encore en l'air. */
export function relanceOuverte(t: TaskLike): boolean {
  if (!isRequest(t)) return false;
  return t.status !== "DONE" && t.status !== "DECLINED" && t.status !== "CANCELLED";
}

const auMs = (d: string | Date | null | undefined): number | null => {
  if (!d) return null;
  const ms = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/** Le moment à partir duquel une relance redevient possible. */
export function prochaineRelance(t: TaskLike): number | null {
  const base = Math.max(auMs(t.lastNudgeAt) ?? 0, auMs(t.requestedAt) ?? 0);
  return base > 0 ? base + RELANCE_DELAI_MS : null;
}

/**
 * QUI peut relancer, et QUAND — la même règle des deux côtés de la frontière.
 *
 * Elle rend un MOTIF quand elle refuse : un bouton qui ne fait rien et ne dit rien envoie
 * cliquer une seconde fois, puis chercher la panne là où il n'y en a pas.
 */
export function peutRelancer(
  t: TaskLike,
  userId: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; raison: string } {
  if (!relanceOuverte(t)) {
    return { ok: false, raison: "Cette demande est close — il n'y a plus personne à relancer." };
  }
  if (!t.createdById || t.createdById !== userId) {
    return { ok: false, raison: "Seule la personne qui a fait la demande peut la relancer." };
  }
  if (t.assignedToId === userId) {
    return { ok: false, raison: "Cette demande est la vôtre — vous n'avez personne à relancer." };
  }
  const prochaine = prochaineRelance(t);
  if (prochaine !== null && now < prochaine) {
    const heures = Math.max(1, Math.ceil((prochaine - now) / 3_600_000));
    return {
      ok: false,
      raison: `Trop tôt : vous pourrez relancer dans ${heures} h. Une relance qui suit la précédente de quelques minutes ne se lit plus.`,
    };
  }
  return { ok: true };
}

/** Le mot de la relance, tel qu'il arrive à la personne — le rang le rend honnête. */
export function relanceTitre(rang: number): string {
  return rang <= 1 ? "Relance : votre demande attend" : `${rang}ᵉ relance : votre demande attend`;
}

export function taskActions(
  t: TaskLike,
  userId: string,
  opts: { canCreateDossier?: boolean; readOnly?: boolean } = {},
): TaskAction[] {
  if (opts.readOnly) return [];

  if (isRequest(t)) {
    // Le parcours d'une demande, du début à la fin — sans jamais de « Démarrer ».
    //
    // La RELANCE s'ajoute pour le demandeur tant que la demande est en l'air : le bouton
    // s'affiche même quand le délai n'est pas écoulé, et c'est délibéré. Le masquer laisserait
    // croire que relancer n'existe pas ; le serveur, lui, dit en une phrase quand ce sera
    // possible — un refus qui s'explique vaut mieux qu'un bouton qui a disparu.
    const relance: TaskAction[] = relanceOuverte(t) && t.createdById === userId && t.assignedToId !== userId
      ? ["relance"] : [];
    if (awaitingResponse(t)) return canRespond(t, userId) ? ["respond", "open"] : [...relance, "open"];
    if (t.status === "DECLINED" || t.status === "CANCELLED") return ["open"];
    return [...relance, "open"];
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
