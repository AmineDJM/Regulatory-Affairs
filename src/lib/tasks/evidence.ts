/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA TÂCHE ET SA PREUVE — pourquoi « en retard » était FAUX.
 *
 * ── LE CAS RÉEL ──────────────────────────────────────────────────────────────────────────
 *
 * Une tâche de Yacine Habes : « Déposer le contrat de la nouvelle consultante médicale dans
 * Ad&Pro > Consulting », échéance 23/08. Yacine A DÉPOSÉ le contrat. Personne n'a rouvert la
 * tâche pour la cocher. Adam a donc annoncé au PDG une tâche « en retard » — vrai au sens du
 * champ `status`, faux au sens de l'entreprise.
 *
 * ── CE QU'ON REFUSE DE FAIRE ─────────────────────────────────────────────────────────────
 *
 * Demander au modèle, à chaque question, de relire toutes les tâches et de deviner si un
 * document quelque part y correspond. Cela coûte un raisonnement à chaque tour, produit une
 * réponse différente d'une fois sur l'autre, et échoue silencieusement.
 *
 * Ce module rend la question DÉTERMINISTE : une tâche déclare CE QU'ELLE ATTEND, un événement
 * métier survient, et le rapprochement est un calcul — pas une opinion.
 *
 * ── LES DEUX DEGRÉS, ET POURQUOI ILS NE SE VALENT PAS ────────────────────────────────────
 *
 *   • ATTENTE DÉCLARÉE — la tâche a été créée avec sa cible (`expectedEvent` + entité). Le
 *     rapprochement est EXACT : on peut clore automatiquement.
 *   • ATTENTE DÉDUITE — la tâche est en texte libre (tout l'historique l'est). On lit le titre,
 *     on reconnaît un geste, on rapproche… et on ne clôt RIEN. On INSCRIT la preuve, et Adam
 *     dit la vérité complète : « la tâche est encore à faire, mais le contrat a bien été déposé
 *     par Yacine le 22/08 ; le statut n'a simplement pas été mis à jour. »
 *
 * Clore automatiquement sur une déduction reviendrait à effacer une tâche réelle sur un
 * homonyme. La preuve est un CONSTAT, la clôture est une DÉCISION — et les deux ne demandent
 * pas le même niveau de certitude.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les événements métier qu'une tâche peut attendre. Fermé : un nom libre ne se rapproche pas. */
export type ExpectedEvent =
  | "DOCUMENT_UPLOADED"
  | "CONTRACT_SIGNED"
  | "INVOICE_ISSUED"
  | "PAYMENT_RECEIVED"
  | "REGULATORY_STATUS_CHANGED"
  | "TENDER_SUBMITTED"
  | "DELIVERY_COMPLETED";

export const EXPECTED_EVENTS: readonly ExpectedEvent[] = [
  "DOCUMENT_UPLOADED", "CONTRACT_SIGNED", "INVOICE_ISSUED", "PAYMENT_RECEIVED",
  "REGULATORY_STATUS_CHANGED", "TENDER_SUBMITTED", "DELIVERY_COMPLETED",
] as const;

/**
 * LA CONFIANCE d'un rapprochement — et ce qu'elle AUTORISE.
 *
 *   • `declared` — la tâche portait sa cible. Clôture automatique permise.
 *   • `strong`   — le geste ET sa destination sont reconnus dans le texte. Preuve inscrite,
 *                  jamais de clôture : c'est encore une lecture de phrase.
 *   • `weak`     — seul le geste est reconnu. On n'inscrit rien, on ne dit rien : une preuve
 *                  douteuse affichée comme un fait est pire que pas de preuve.
 */
export type Confidence = "declared" | "strong" | "weak";

export interface TaskExpectation {
  event: ExpectedEvent;
  confidence: Confidence;
  /** Le domaine visé, quand le texte le nomme (« Ad&Pro > Consulting », « Legal »). */
  domain?: string;
  /** Les mots porteurs retenus — affichés à l'humain qui arbitre, jamais interprétés. */
  hints: string[];
}

export interface BusinessEventLike {
  type: string;
  occurredAt: Date;
  sourceDomain: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
}

export interface TaskLike {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  assignedToId?: string | null;
  createdAt: Date;
  /** L'attente DÉCLARÉE à la création, si la tâche en porte une. */
  expectedEvent?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

// ─────────────────────────── Déduction depuis le texte libre ───────────────────────────

const fold = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ");

/**
 * LES GESTES qui produisent un document. Le verbe seul ne suffit pas — « préparer le contrat »
 * n'est pas « déposer le contrat » : le premier n'a pas d'événement observable, le second si.
 */
const GESTE_DEPOT = /\b(depose[rz]?|deposer|uploade?[rz]?|televerse[rz]?|telecharge[rz]?\s+dans|joind?re|ajoute[rz]?|met(?:tre|s)?)\b/;

/** L'OBJET attendu — ce qui, une fois déposé, satisfait la tâche. */
const OBJETS: [RegExp, ExpectedEvent][] = [
  [/\bcontrats?\b/, "CONTRACT_SIGNED"],
  [/\bfactures?\b/, "INVOICE_ISSUED"],
  [/\b(documents?|pieces?|attestations?|justificatifs?|scans?|pdf)\b/, "DOCUMENT_UPLOADED"],
];

/** Les DESTINATIONS nommées dans nos tâches réelles — un module de l'ERP, jamais un chemin libre. */
const DESTINATIONS: [RegExp, string][] = [
  [/\bad\s*&?\s*pro\b.{0,20}\bconsulting\b|\bconsulting\b.{0,20}\bad\s*&?\s*pro\b/, "ADPRO_CONSULTING"],
  [/\bad\s*&?\s*pro\b/, "ADPRO"],
  [/\blegal\b|\bjuridique\b/, "LEGAL"],
  [/\bdrive\b/, "DRIVE"],
  [/\bregulatory\b|\breglementaire\b/, "REGULATORY"],
  [/\bfinances?\b|\bcomptabilite\b/, "FINANCES"],
];

/**
 * CE QU'UNE TÂCHE EN TEXTE LIBRE ATTEND — ou `null` quand rien ne se déduit sûrement.
 *
 * Rendre `null` est le comportement NORMAL et attendu pour la plupart des tâches : « rappeler
 * Karim », « préparer la réunion » n'ont aucun événement observable. Forcer une attente sur
 * ces tâches-là produirait des rapprochements faux, ce qui est exactement le défaut qu'on
 * corrige, retourné.
 */
export function inferExpectation(title: string, description?: string | null): TaskExpectation | null {
  const texte = fold(`${title ?? ""} ${description ?? ""}`);
  if (!GESTE_DEPOT.test(texte)) return null;

  const objet = OBJETS.find(([re]) => re.test(texte));
  if (!objet) return null;

  const dest = DESTINATIONS.find(([re]) => re.test(texte));
  const hints: string[] = [];
  const geste = texte.match(GESTE_DEPOT)?.[0];
  if (geste) hints.push(geste);
  const nomObjet = texte.match(objet[0])?.[0];
  if (nomObjet) hints.push(nomObjet);
  if (dest) hints.push(dest[1]);

  return {
    event: objet[1],
    // Sans destination nommée, on reste en `weak` : « dépose le contrat » sans dire où ne peut
    // pas être rapproché d'un dépôt précis sans risquer l'homonyme.
    confidence: dest ? "strong" : "weak",
    ...(dest ? { domain: dest[1] } : {}),
    hints,
  };
}

/** L'attente EFFECTIVE d'une tâche : celle qu'elle déclare, sinon celle qu'on déduit. */
export function expectationOf(task: TaskLike): TaskExpectation | null {
  const declare = (task.expectedEvent ?? "").trim();
  if (declare && (EXPECTED_EVENTS as readonly string[]).includes(declare)) {
    return { event: declare as ExpectedEvent, confidence: "declared", hints: [] };
  }
  return inferExpectation(task.title, task.description);
}

// ─────────────────────────── Le rapprochement ───────────────────────────

export interface Match {
  taskId: string;
  confidence: Confidence;
  /** Clore la tâche ? VRAI seulement sur une attente déclarée — voir l'en-tête. */
  autoComplete: boolean;
  reason: string;
}

/** Le domaine d'un événement, ramené au vocabulaire des destinations de tâche. */
const domaineDe = (e: BusinessEventLike): string => (e.sourceDomain ?? "").toUpperCase();

/**
 * CET ÉVÉNEMENT SATISFAIT-IL CETTE TÂCHE ?
 *
 * Trois conditions, toutes nécessaires :
 *   1. la tâche est OUVERTE (une tâche close n'a plus rien à prouver) ;
 *   2. l'événement est du TYPE attendu ;
 *   3. il est survenu APRÈS la création de la tâche — un document déposé la veille de la
 *      demande ne répond pas à la demande, et c'est précisément le piège qui ferait clore une
 *      tâche par un dépôt sans rapport.
 *
 * Sur une attente DÉCLARÉE, l'entité doit correspondre exactement en plus. Sur une attente
 * DÉDUITE, le domaine doit correspondre — et le résultat reste un constat, pas une clôture.
 */
export function matchEventToTask(event: BusinessEventLike, task: TaskLike): Match | null {
  if (task.status === "DONE" || task.status === "CANCELLED") return null;

  const attente = expectationOf(task);
  if (!attente) return null;
  if (attente.event !== event.type) return null;
  if (event.occurredAt.getTime() < task.createdAt.getTime()) return null;

  if (attente.confidence === "declared") {
    // L'entité déclarée fait foi quand elle est là ; sinon le type d'événement suffit, puisque
    // quelqu'un a explicitement rattaché cette tâche à cet événement à la création.
    const memeEntite =
      !task.relatedEntityId
      || (task.relatedEntityType === event.entityType && task.relatedEntityId === event.entityId);
    if (!memeEntite) return null;
    return {
      taskId: task.id,
      confidence: "declared",
      autoComplete: true,
      reason: `Attente déclarée « ${attente.event} » satisfaite par ${event.entityType ?? "un événement"} ${event.entityId ?? ""}`.trim(),
    };
  }

  if (attente.confidence === "weak") return null; // on n'inscrit rien sur un geste sans cible

  if (attente.domain && !domaineDe(event).includes(attente.domain.split("_")[0])) return null;

  return {
    taskId: task.id,
    confidence: "strong",
    // JAMAIS de clôture sur une déduction. C'est la ligne qui empêche ce module d'effacer une
    // vraie tâche sur une ressemblance de mots.
    autoComplete: false,
    reason: `Le geste attendu (${attente.hints.join(", ")}) semble accompli dans ${event.sourceDomain}`,
  };
}

/** Tous les rapprochements d'un événement, sur un lot de tâches ouvertes. */
export function matchEvent(event: BusinessEventLike, tasks: TaskLike[]): Match[] {
  return tasks.map((t) => matchEventToTask(event, t)).filter((m): m is Match => m !== null);
}

/**
 * LA PHRASE QU'ADAM DOIT DIRE quand une tâche en retard porte une preuve.
 *
 * Elle est construite ICI, en code, et pas laissée à la rédaction du modèle : c'est une
 * information d'état, elle doit sortir identique à chaque fois. Un modèle qui la reformule
 * finit par dire « c'est fait » — le contraire de ce que le champ raconte.
 */
export function evidenceSentence(input: {
  title: string;
  evidenceAt: Date;
  actorName?: string | null;
  what?: string | null;
}): string {
  const jour = input.evidenceAt.toISOString().slice(0, 10).split("-").reverse().join("/");
  const qui = input.actorName ? ` par ${input.actorName}` : "";
  const quoi = input.what ? ` (${input.what})` : "";
  return (
    `La tâche « ${input.title} » est toujours marquée à faire, mais le geste attendu${quoi} a bien `
    + `été accompli${qui} le ${jour}. Le statut n'a simplement pas été mis à jour.`
  );
}
