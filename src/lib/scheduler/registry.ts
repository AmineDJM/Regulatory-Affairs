/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DES TRAITEMENTS PLANIFIABLES — la liste FERMÉE de ce qu'une planification peut faire.
 *
 * ── LA GARDE, ET POURQUOI ELLE EST ICI PLUTÔT QUE DANS UN PROMPT ─────────────────────────
 *
 * Une planification porte une CLÉ, jamais du code. Elle ne peut donc déclencher que ce qui figure
 * dans cette table. Si quelqu'un — ou un modèle — écrivait `kind: "supprime tout"` dans la base,
 * le planificateur ne trouverait pas la clé et refuserait, sans avoir eu besoin de comprendre la
 * demande.
 *
 * C'est la traduction, pour le temps différé, de la règle du produit : **une planification est un
 * DÉCLENCHEUR, jamais une dérogation.** Elle ne contourne aucune approbation. Un traitement qui
 * enverrait un e-mail ou modifierait l'ERP n'a pas sa place ici : il passe par le chemin canonique
 * avec sa confirmation humaine. `mutates: false` sur chaque entrée n'est pas décoratif — un test
 * fige la propriété, de sorte qu'ajouter un traitement mutant casse la suite au lieu de passer
 * inaperçu dans une revue.
 *
 * ── POURQUOI LES TRAITEMENTS SONT DES FONCTIONS INJECTÉES ────────────────────────────────
 *
 * Le registre ne connaît AUCUN module métier. Ce sont les modules qui s'enregistrent au démarrage.
 * Sans cela, ce fichier importerait la moitié de l'ERP et deviendrait le point de couplage
 * universel — et un test de planification devrait charger tout le produit pour vérifier un calcul
 * d'échéance.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'un traitement reçoit. Volontairement maigre : plus il en sait, plus il peut nuire. */
export interface WorkflowContext {
  workflowId: string;
  /** Au nom de QUI le traitement s'exécute. Le périmètre de lecture ne dépasse jamais cette personne. */
  ownerId: string;
  payload: Record<string, unknown>;
  /** L'instant de référence du passage — passé explicitement pour que les tests soient reproductibles. */
  now: Date;
}

/** Ce qu'un traitement rend. `summary` est ce que l'utilisateur lit dans l'historique. */
export interface WorkflowOutcome {
  /** `false` = le traitement a constaté qu'il n'avait rien à faire. Ce n'est PAS un échec. */
  didWork: boolean;
  summary: string;
}

export interface WorkflowHandler {
  /** La clé stockée en base. Stable : la renommer orphelinerait les planifications existantes. */
  kind: string;
  /** Ce que l'utilisateur choisit dans une liste. */
  label: string;
  /** Ce que ça fait, en une phrase, pour que le choix soit éclairé. */
  description: string;
  /**
   * TOUJOURS `false`, et c'est vérifié par un test. Le champ existe pour rendre la règle
   * EXPLICITE à l'endroit où quelqu'un serait tenté de l'enfreindre — pas pour laisser la porte
   * entrouverte.
   */
  mutates: false;
  run: (ctx: WorkflowContext) => Promise<WorkflowOutcome>;
}

const HANDLERS = new Map<string, WorkflowHandler>();

/**
 * ENREGISTRE UN TRAITEMENT. Idempotent : réenregistrer la même clé remplace, ce qui est le
 * comportement attendu en rechargement à chaud et évite un jet d'exception au démarrage.
 */
export function registerWorkflow(h: WorkflowHandler): void {
  HANDLERS.set(h.kind, h);
}

export function workflowHandler(kind: string): WorkflowHandler | null {
  return HANDLERS.get(kind) ?? null;
}

/** Le catalogue, pour l'écran de création. Trié par libellé : une liste stable se relit. */
export function availableWorkflows(): { kind: string; label: string; description: string }[] {
  return [...HANDLERS.values()]
    .map((h) => ({ kind: h.kind, label: h.label, description: h.description }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

/** Une clé est-elle exécutable ? La question que le planificateur pose avant tout le reste. */
export const isKnownWorkflow = (kind: string): boolean => HANDLERS.has(kind);

/** Vidage — réservé aux tests, qui doivent partir d'un registre connu. */
export function resetWorkflowRegistry(): void {
  HANDLERS.clear();
}
